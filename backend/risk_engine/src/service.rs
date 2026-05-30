//! Risk Engine Service
//!
//! Core service that evaluates risk, records events, and 
//! triggers appropriate responses (freeze, flag, alert).

use crate::detectors;
use crate::models::*;
use chrono::Utc;
use sqlx::PgPool;

pub struct RiskEngineService {
    pool: PgPool,
}

impl RiskEngineService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Record a risk event and evaluate its impact
    pub async fn record_event(
        &self,
        req: &RecordRiskEventRequest,
    ) -> Result<RiskEvent, RiskError> {
        let source_ip = req.source_ip.clone();

        let risk_score_delta = match req.severity.as_str() {
            "critical" => 100,
            "high" => 50,
            "medium" => 20,
            "low" => 5,
            _ => 0,
        };

        let event = sqlx::query_as::<_, RiskEvent>(
            "INSERT INTO risk_events 
             (user_id, company_id, event_type, severity, risk_score_delta,
              source_ip, user_agent, device_fingerprint, description, details, is_automated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
             RETURNING *",
        )
        .bind(req.user_id)
        .bind(req.company_id)
        .bind(&req.event_type)
        .bind(&req.severity)
        .bind(risk_score_delta)
        .bind(source_ip)
        .bind(&req.user_agent)
        .bind(&req.device_fingerprint)
        .bind(&req.description)
        .bind(&req.details)
        .fetch_one(&self.pool)
        .await?;

        // If user_id is present, evaluate risk level and potentially freeze
        if let Some(user_id) = req.user_id {
            self.evaluate_user_risk(user_id).await?;
        }

        // Publish event
        let payload = serde_json::json!({
            "risk_event_id": event.id,
            "user_id": req.user_id,
            "event_type": req.event_type,
            "severity": req.severity,
            "description": req.description
        });
        let aggregate_id = req.user_id.unwrap_or(0);
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "user",
            aggregate_id,
            "risk.event.detected",
            &payload,
        )
        .await;

        // If critical, create moderation case
        if req.severity == "critical" {
            self.create_moderation_case(&event).await?;
        }

        Ok(event)
    }

    /// Evaluate total risk for a user
    async fn evaluate_user_risk(&self, user_id: i64) -> Result<String, RiskError> {
        // Calculate cumulative risk from recent events
        let total_risk: i32 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(risk_score_delta), 0) 
             FROM risk_events 
             WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        let risk_level = match total_risk {
            0..=10 => "LOW",
            11..=50 => "MEDIUM",
            51..=100 => "HIGH",
            _ => "CRITICAL",
        };

        // Update user's risk level
        sqlx::query(
            "UPDATE user_verification_profiles 
             SET risk_level = $2, last_risk_assessment_at = NOW(), updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(risk_level)
        .execute(&self.pool)
        .await?;

        // If CRITICAL, freeze the account
        if risk_level == "CRITICAL" {
            // Only freeze if not already in a review state
            sqlx::query(
                "UPDATE user_verification_profiles 
                 SET age_verification_state = 'AGE_LOCKED', is_under_investigation = TRUE,
                     updated_at = NOW()
                 WHERE user_id = $1 
                 AND age_verification_state NOT IN ('AGE_LOCKED', 'AGE_UNDER_REVIEW')",
            )
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        }

        Ok(risk_level.to_string())
    }

    /// Create a moderation case for critical events
    async fn create_moderation_case(&self, event: &RiskEvent) -> Result<(), RiskError> {
        sqlx::query(
            "INSERT INTO moderation_queue 
             (target_user_id, source, priority, category, description, 
              ai_analysis, ai_confidence, ai_recommendation, status)
             VALUES ($1, 'RISK_ENGINE', 'critical', $2, $3, $4, 0.95, 'ACCOUNT_FREEZE', 'open')",
        )
        .bind(event.user_id)
        .bind(&event.event_type)
        .bind(&event.description)
        .bind(serde_json::json!({"risk_event_id": event.id, "severity": event.severity}))
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get risk assessment for a user
    pub async fn assess_user(
        &self,
        user_id: i64,
    ) -> Result<RiskAssessmentResponse, RiskError> {
        let profile: Option<(String, i32)> = sqlx::query_as(
            "SELECT risk_level, trust_score FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .map(|row: (String, i32)| row);

        let (risk_level, risk_score) = profile.ok_or(RiskError::UserNotFound)?;

        // Get active flags (unresolved risk events)
        let flags: Vec<RiskFlag> = sqlx::query_as(
            "SELECT event_type, severity, description, created_at as detected_at
             FROM risk_events 
             WHERE user_id = $1 AND is_resolved = FALSE
             ORDER BY created_at DESC LIMIT 20",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|r: RiskEvent| RiskFlag {
            event_type: r.event_type,
            severity: r.severity,
            description: r.description,
            detected_at: r.created_at,
        })
        .collect();

        // Get recent events
        let recent_events = sqlx::query_as::<_, RiskEvent>(
            "SELECT * FROM risk_events 
             WHERE user_id = $1 
             ORDER BY created_at DESC LIMIT 10",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let total_risk: i32 = recent_events.iter().map(|e| e.risk_score_delta).sum();

        Ok(RiskAssessmentResponse {
            user_id,
            risk_level,
            risk_score: total_risk,
            active_flags: flags,
            recent_events,
        })
    }

    /// Run periodic risk scans (called by cron)
    pub async fn run_periodic_scan(&self) -> Result<i32, RiskError> {
        let events = detectors::run_all_detectors(&self.pool).await?;
        let mut count = 0;

        for event in events {
            let req = RecordRiskEventRequest {
                user_id: event.user_id,
                company_id: event.company_id,
                event_type: event.event_type,
                severity: event.severity,
                description: event.description,
                details: event.details,
                source_ip: event.source_ip,
                user_agent: None,
                device_fingerprint: None,
            };

            self.record_event(&req).await?;
            count += 1;
        }

        Ok(count)
    }
}
