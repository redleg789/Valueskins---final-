//! Risk Detectors
//!
//! Individual detection modules for specific threat patterns.
//! Each detector implements the RiskDetector trait.

use crate::models::RiskEvent;
use chrono::Utc;
use sqlx::PgPool;

/// Common trait for all risk detectors
#[async_trait::async_trait]
pub trait RiskDetector: Send + Sync {
    fn name(&self) -> &'static str;
    async fn evaluate(&self, pool: &PgPool) -> Result<Vec<RiskEvent>, sqlx::Error>;
}

/// Detect mass account creation from same IP (sybil attack)
pub struct SybilDetector {
    pub max_accounts_per_ip: i64,
    pub window_hours: i64,
}

#[async_trait::async_trait]
impl RiskDetector for SybilDetector {
    fn name(&self) -> &'static str {
        "sybil_detector"
    }

    async fn evaluate(&self, pool: &PgPool) -> Result<Vec<RiskEvent>, sqlx::Error> {
        let events = sqlx::query_as::<_, (String, i64)>(
            "SELECT account_created_ip, COUNT(*) as cnt
             FROM user_verification_profiles
             WHERE account_created_ip IS NOT NULL
               AND created_at > NOW() - ($1::int || ' hours')::INTERVAL
             GROUP BY account_created_ip
             HAVING COUNT(*) > $2",
        )
        .bind(self.window_hours)
        .bind(self.max_accounts_per_ip)
        .fetch_all(pool)
        .await?;

        let mut risk_events = Vec::new();
        for (ip, count) in events {
            // Find users from this IP for details
            let user_ids: Vec<i64> = sqlx::query_scalar(
                "SELECT user_id FROM user_verification_profiles 
                 WHERE account_created_ip = $1 
                 AND created_at > NOW() - ($2::int || ' hours')::INTERVAL
                 LIMIT 100",
            )
            .bind(&ip)
            .bind(self.window_hours)
            .fetch_all(pool)
            .await?;

            risk_events.push(RiskEvent {
                id: 0,
                user_id: None,
                company_id: None,
                event_type: "SYBIL_ATTACK".to_string(),
                severity: "high".to_string(),
                risk_score_delta: 50,
                source_ip: Some(ip.clone()),
                user_agent: None,
                device_fingerprint: None,
                description: format!("Mass account creation detected: {} accounts from IP {}", count, ip),
                details: Some(serde_json::json!({
                    "account_count": count,
                    "window_hours": self.window_hours,
                    "affected_user_ids": user_ids
                })),
                is_automated: true,
                is_resolved: false,
                resolution_notes: None,
                resolved_by_user_id: None,
                resolved_at: None,
                created_at: Utc::now(),
            });
        }

        Ok(risk_events)
    }
}

/// Detect failed login velocity (brute force / credential stuffing)
pub struct BruteForceDetector {
    pub max_failures_per_hour: i64,
}

#[async_trait::async_trait]
impl RiskDetector for BruteForceDetector {
    fn name(&self) -> &'static str {
        "brute_force_detector"
    }

    async fn evaluate(&self, _pool: &PgPool) -> Result<Vec<RiskEvent>, sqlx::Error> {
        // In production: query auth_service login attempt logs
        Ok(Vec::new())
    }
}

/// Detect same document used by multiple users (identity theft / document reuse)
pub struct DocumentReuseDetector;

#[async_trait::async_trait]
impl RiskDetector for DocumentReuseDetector {
    fn name(&self) -> &'static str {
        "document_reuse_detector"
    }

    async fn evaluate(&self, pool: &PgPool) -> Result<Vec<RiskEvent>, sqlx::Error> {
        let events = sqlx::query_as::<_, (String, i64)>(
            "SELECT file_hash, COUNT(DISTINCT user_id) as cnt
             FROM identity_documents
             WHERE user_id IS NOT NULL AND document_status = 'VERIFIED'
             GROUP BY file_hash
             HAVING COUNT(DISTINCT user_id) > 1",
        )
        .fetch_all(pool)
        .await?;

        let mut risk_events = Vec::new();
        for (file_hash, count) in events {
            let user_ids: Vec<i64> = sqlx::query_scalar(
                "SELECT DISTINCT user_id FROM identity_documents WHERE file_hash = $1 AND user_id IS NOT NULL",
            )
            .bind(&file_hash)
            .fetch_all(pool)
            .await?;

            risk_events.push(RiskEvent {
                id: 0,
                user_id: None,
                company_id: None,
                event_type: "IDENTITY_LAUNDERING".to_string(),
                severity: "critical".to_string(),
                risk_score_delta: 100,
                source_ip: None,
                user_agent: None,
                device_fingerprint: None,
                description: format!("Document reused by {} different users — possible identity laundering", count),
                details: Some(serde_json::json!({
                    "file_hash": file_hash,
                    "user_count": count,
                    "affected_user_ids": user_ids
                })),
                is_automated: true,
                is_resolved: false,
                resolution_notes: None,
                resolved_by_user_id: None,
                resolved_at: None,
                created_at: Utc::now(),
            });
        }

        Ok(risk_events)
    }
}

/// Detect rapid profile changes (account takeover indicators)
pub struct ProfileChangeDetector;

#[async_trait::async_trait]
impl RiskDetector for ProfileChangeDetector {
    fn name(&self) -> &'static str {
        "profile_change_detector"
    }

    async fn evaluate(&self, pool: &PgPool) -> Result<Vec<RiskEvent>, sqlx::Error> {
        // In production: compare audit_log for rapid profile changes
        // This is a simplified version
        Ok(Vec::new())
    }
}

/// Run all detectors and return aggregated results
pub async fn run_all_detectors(pool: &PgPool) -> Result<Vec<RiskEvent>, sqlx::Error> {
    let detectors: Vec<Box<dyn RiskDetector>> = vec![
        Box::new(SybilDetector {
            max_accounts_per_ip: 5,
            window_hours: 24,
        }),
        Box::new(BruteForceDetector {
            max_failures_per_hour: 20,
        }),
        Box::new(DocumentReuseDetector),
        Box::new(ProfileChangeDetector),
    ];

    let mut all_events = Vec::new();
    for detector in &detectors {
        match detector.evaluate(pool).await {
            Ok(events) => all_events.extend(events),
            Err(e) => tracing::error!(detector = detector.name(), error = %e, "Risk detector failed"),
        }
    }

    Ok(all_events)
}
