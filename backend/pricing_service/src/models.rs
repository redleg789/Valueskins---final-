use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Market pricing benchmark for a (category, platform, content_type, level) tuple.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PricingBenchmark {
    pub id: i64,
    pub category: String,
    pub platform: String,
    pub content_type: String,
    pub level: i16,
    pub p25_rate_cents: i64,
    pub median_rate_cents: i64,
    pub p75_rate_cents: i64,
    pub trend: String,
    pub change_last_month_pct: f64,
    pub data_points: i32,
    pub benchmark_version: i32,
    pub computed_at: DateTime<Utc>,
}

/// Personal valuation for a creator based on their profile and deal history.
#[derive(Debug, Serialize)]
pub struct PersonalValuation {
    pub estimated_rate_cents: i64,
    pub confidence: String,
    pub factors: serde_json::Value,
    pub market_position: String,
    pub benchmark: Option<PricingBenchmark>,
}

/// Query params for benchmark lookup.
#[derive(Debug, Deserialize)]
pub struct BenchmarkQuery {
    pub category: String,
    pub platform: String,
    pub content_type: String,
    pub level: Option<i16>,
    pub version: Option<i32>,
}

/// Query params for personal valuation.
#[derive(Debug, Deserialize)]
pub struct ValuationQuery {
    pub persona_id: i64,
    pub content_type: Option<String>,
    pub platform: Option<String>,
}

/// Request to trigger benchmark recomputation (admin only).
#[derive(Debug, Deserialize)]
pub struct RecomputeRequest {
    pub category: Option<String>,
    pub platform: Option<String>,
}
