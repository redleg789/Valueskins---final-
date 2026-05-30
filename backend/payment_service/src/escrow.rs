//! Escrow system: holds funds until deal conditions met

use sqlx::PgPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "escrow_stage_status", rename_all = "lowercase")]
pub enum StageStatus {
    Pending,
    Released,
    Disputed,
    Refunded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscrowStage {
    pub id: String,
    pub deal_id: String,
    pub stage_number: i32,
    pub description: String,
    pub amount_usd: i32,
    pub status: String,
    pub condition: String, // "upfront", "on_approval", "on_delivery"
    pub released_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEscrowRequest {
    pub deal_id: String,
    pub total_amount: i32,
    pub stages: Vec<EscrowStageRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscrowStageRequest {
    pub description: String,
    pub percentage: i32, // 0-100, must sum to 100
    pub condition: String,
}

pub struct EscrowService {
    pool: PgPool,
}

impl EscrowService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create escrow with multiple stages
    /// Validates stages sum to 100%
    pub async fn create_escrow(&self, req: CreateEscrowRequest) -> Result<Vec<EscrowStage>, EscrowError> {
        // Validate percentages sum to 100
        let total_percent: i32 = req.stages.iter().map(|s| s.percentage).sum();
        if total_percent != 100 {
            return Err(EscrowError::InvalidStages(
                format!("Stages must sum to 100%, got {}", total_percent)
            ));
        }

        let mut stages = Vec::new();
        let now = Utc::now();

        for (idx, stage_req) in req.stages.iter().enumerate() {
            let stage_id = uuid::Uuid::new_v4().to_string();
            let amount = (req.total_amount as f32 * stage_req.percentage as f32 / 100.0).round() as i32;

            // Create stage in database
            sqlx::query(
                r#"
                INSERT INTO escrow_stages
                (id, deal_id, stage_number, description, amount_usd, status, condition, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                "#
            )
            .bind(&stage_id)
            .bind(&req.deal_id)
            .bind((idx + 1) as i32)
            .bind(&stage_req.description)
            .bind(amount)
            .bind("pending")
            .bind(&stage_req.condition)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(|e| EscrowError::DatabaseError(e.to_string()))?;

            stages.push(EscrowStage {
                id: stage_id,
                deal_id: req.deal_id.clone(),
                stage_number: (idx + 1) as i32,
                description: stage_req.description.clone(),
                amount_usd: amount,
                status: "pending".to_string(),
                condition: stage_req.condition.clone(),
                released_at: None,
                created_at: now,
            });
        }

        Ok(stages)
    }

    /// Release funds from a stage (after condition met)
    pub async fn release_stage(&self, stage_id: &str) -> Result<(), EscrowError> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE escrow_stages SET status = 'released', released_at = $1 WHERE id = $2"
        )
        .bind(now)
        .bind(stage_id)
        .execute(&self.pool)
        .await
        .map_err(|e| EscrowError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Dispute a stage (funds frozen pending resolution)
    pub async fn dispute_stage(&self, stage_id: &str) -> Result<(), EscrowError> {
        sqlx::query(
            "UPDATE escrow_stages SET status = 'disputed' WHERE id = $1"
        )
        .bind(stage_id)
        .execute(&self.pool)
        .await
        .map_err(|e| EscrowError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Refund a stage (return to brand if deal fails)
    pub async fn refund_stage(&self, stage_id: &str) -> Result<(), EscrowError> {
        sqlx::query(
            "UPDATE escrow_stages SET status = 'refunded' WHERE id = $1"
        )
        .bind(stage_id)
        .execute(&self.pool)
        .await
        .map_err(|e| EscrowError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Get all stages for a deal
    pub async fn get_deal_escrow(&self, deal_id: &str) -> Result<Vec<EscrowStage>, EscrowError> {
        let stages: Vec<(String, String, i32, String, i32, String, String, Option<DateTime<Utc>>, DateTime<Utc>)> = sqlx::query_as(
            "SELECT id, deal_id, stage_number, description, amount_usd, status, condition, released_at, created_at FROM escrow_stages WHERE deal_id = $1 ORDER BY stage_number ASC"
        )
        .bind(deal_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| EscrowError::DatabaseError(e.to_string()))?;

        Ok(stages.into_iter().map(|(id, deal_id, stage_number, description, amount_usd, status, condition, released_at, created_at)| {
            EscrowStage {
                id,
                deal_id,
                stage_number,
                description,
                amount_usd,
                status,
                condition,
                released_at,
                created_at,
            }
        }).collect())
    }

    /// Get total escrowed amount for a deal
    pub async fn get_total_escrowed(&self, deal_id: &str) -> Result<i32, EscrowError> {
        let result: (Option<i64>,) = sqlx::query_as(
            "SELECT SUM(amount_usd) FROM escrow_stages WHERE deal_id = $1 AND status = 'pending'"
        )
        .bind(deal_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| EscrowError::DatabaseError(e.to_string()))?;

        Ok(result.0.unwrap_or(0) as i32)
    }
}

#[derive(Debug)]
pub enum EscrowError {
    InvalidStages(String),
    DatabaseError(String),
    NotFound,
}

impl std::fmt::Display for EscrowError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EscrowError::InvalidStages(msg) => write!(f, "Invalid escrow stages: {}", msg),
            EscrowError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            EscrowError::NotFound => write!(f, "Escrow not found"),
        }
    }
}

impl std::error::Error for EscrowError {}
