use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Event tracking for analytics
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEventRequest {
    pub event_type: String,
    pub user_id: Option<String>,
    pub persona_id: Option<i64>,
    pub metadata: Option<serde_json::Value>,
}

/// Growth metrics for tracking billion-dollar trajectory
#[derive(Debug, Serialize, Deserialize)]
pub struct GrowthMetrics {
    pub total_users: i64,
    pub weekly_growth_pct: f64,
    pub daily_active_users: i64,
    pub monthly_active_users: i64,
    pub retention_7d: f64,
    pub retention_30d: f64,
}

/// Viral metrics - CRITICAL for proving K-factor > 1
#[derive(Debug, Serialize, Deserialize)]
pub struct ViralMetrics {
    pub k_factor: f64,           // Users * referral_rate * conversion_rate
    pub referral_rate: f64,      // % of users who refer others
    pub avg_referrals_per_user: f64,
    pub referral_conversion_rate: f64,
    pub viral_coefficient: f64,   // Compound growth indicator
}

/// Revenue metrics for proving business model
#[derive(Debug, Serialize, Deserialize)]
pub struct RevenueMetrics {
    pub total_gmv: i64,           // Gross merchandise value
    pub platform_revenue: i64,    // 5% take rate
    pub avg_deal_size: i64,
    pub completed_deals: i64,
    pub monthly_revenue: i64,
    pub revenue_growth_pct: f64,
}

/// Conversion funnel metrics
#[derive(Debug, Serialize, Deserialize)]
pub struct FunnelMetrics {
    pub visitors: i64,
    pub signups: i64,
    pub activated: i64,         // Connected wallet / created persona
    pub engaged: i64,           // Applied to opportunity
    pub converted: i64,         // Completed deal
    pub signup_rate: f64,
    pub activation_rate: f64,
    pub conversion_rate: f64,
}

/// Engagement metrics
#[derive(Debug, Serialize, Deserialize)]
pub struct EngagementMetrics {
    pub avg_session_duration: f64,
    pub pages_per_session: f64,
    pub bounce_rate: f64,
    pub feature_adoption: std::collections::HashMap<String, f64>,
}

/// Complete analytics dashboard response
#[derive(Debug, Serialize, Deserialize)]
pub struct AnalyticsDashboard {
    pub growth: GrowthMetrics,
    pub viral: ViralMetrics,
    pub revenue: RevenueMetrics,
    pub funnel: FunnelMetrics,
    pub engagement: EngagementMetrics,
    pub generated_at: DateTime<Utc>,
}

/// Time series data point
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TimeSeriesPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
}

/// Analytics event stored in database
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnalyticsEvent {
    pub id: i64,
    pub event_type: String,
    pub user_id: Option<String>,
    pub persona_id: Option<i64>,
    pub session_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub ip_hash: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}
