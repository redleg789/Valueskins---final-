use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Reputation export snapshot (Ed25519-signed).
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReputationExport {
    pub id: i64,
    pub persona_id: i64,
    pub export_version: i32,
    pub deal_count: i32,
    pub avg_deal_cents: i64,
    pub completion_rate_pct: f64,
    pub on_time_rate_pct: f64,
    pub trust_scores_snapshot: serde_json::Value,
    pub testimonial_count: i32,
    pub signed_hash: String,
    pub created_at: DateTime<Utc>,
}

/// Payload that gets signed (deterministic serialization).
#[derive(Debug, Serialize)]
pub struct ReputationPayload {
    pub persona_id: i64,
    pub export_version: i32,
    pub deal_count: i32,
    pub avg_deal_cents: i64,
    pub completion_rate_pct: f64,
    pub on_time_rate_pct: f64,
    pub trust_scores: serde_json::Value,
    pub testimonial_count: i32,
    pub generated_at: DateTime<Utc>,
}

/// Query params for export request.
#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    pub persona_id: i64,
}

/// Query for verification.
#[derive(Debug, Deserialize)]
pub struct VerifyQuery {
    pub persona_id: i64,
    pub version: i32,
}

/// Verification result.
#[derive(Debug, Serialize)]
pub struct VerificationResult {
    pub valid: bool,
    pub export: Option<ReputationExport>,
    pub public_key: String,
}

/// Query for listing exports.
#[derive(Debug, Deserialize)]
pub struct ExportListQuery {
    pub persona_id: i64,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}
