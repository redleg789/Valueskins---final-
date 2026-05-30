//! Real-time event tracking for acquisition analytics
//! Tracks: user flows, deal progression, conversion funnels, creator/brand behavior

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "event_type", rename_all = "snake_case")]
pub enum EventType {
    // Auth events
    UserSignup,
    UserLogin,
    OauthSuccess,
    OauthFailed,

    // Creator discovery events
    CreatorSearch,
    CreatorProfileView,
    CreatorApply,

    // Opportunity/Deal events
    OpportunityCreate,
    OpportunityView,
    OpportunityApply,
    OfferSent,
    OfferAccepted,
    OfferCountered,
    OfferRejected,

    // Deal lifecycle events
    ContractGenerated,
    ContractSigned,
    EscrowFunded,
    DeliverableSubmitted,
    DeliverableApproved,
    DeliverableRejected,
    PaymentReleased,
    DealCompleted,

    // Chat/Communication events
    ChatMessageSent,
    ChatMessageRead,
    ScriptNegotiationStarted,
    ScriptVersionApproved,

    // Rating/Review events
    CreatorRated,
    BrandRated,
    DisputeFiled,
    DisputeResolved,

    // Platform engagement events
    TipSent,
    RepeatDealCreated,
    ProfileUpdated,
    PortfolioAdded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsEvent {
    pub id: String,
    pub event_type: EventType,
    pub user_id: i64,
    pub persona_id: Option<i64>,
    pub deal_id: Option<i64>,
    pub opportunity_id: Option<i64>,
    pub deal_room_id: Option<i64>,
    pub timestamp: DateTime<Utc>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub country: Option<String>,
    pub device_type: Option<String>, // mobile, desktop, tablet
    pub metadata: serde_json::Value,
}

impl AnalyticsEvent {
    pub fn new(
        event_type: EventType,
        user_id: i64,
        persona_id: Option<i64>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            event_type,
            user_id,
            persona_id,
            deal_id: None,
            opportunity_id: None,
            deal_room_id: None,
            timestamp: Utc::now(),
            user_agent: None,
            ip_address: None,
            country: None,
            device_type: None,
            metadata: serde_json::json!({}),
        }
    }

    pub fn with_deal(mut self, deal_id: i64) -> Self {
        self.deal_id = Some(deal_id);
        self
    }

    pub fn with_opportunity(mut self, opportunity_id: i64) -> Self {
        self.opportunity_id = Some(opportunity_id);
        self
    }

    pub fn with_deal_room(mut self, deal_room_id: i64) -> Self {
        self.deal_room_id = Some(deal_room_id);
        self
    }

    pub fn with_metadata(mut self, key: &str, value: serde_json::Value) -> Self {
        if let serde_json::Value::Object(ref mut map) = self.metadata {
            map.insert(key.to_string(), value);
        }
        self
    }

    pub fn with_location(mut self, ip: String, country: String) -> Self {
        self.ip_address = Some(ip);
        self.country = Some(country);
        self
    }

    pub fn with_device(mut self, user_agent: String, device_type: String) -> Self {
        self.user_agent = Some(user_agent);
        self.device_type = Some(device_type);
        self
    }
}

pub struct AnalyticsEventTracker {
    pool: PgPool,
}

impl AnalyticsEventTracker {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Track an event asynchronously (fire-and-forget)
    pub async fn track(&self, event: AnalyticsEvent) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO analytics_events
                (id, event_type, user_id, persona_id, deal_id, opportunity_id, deal_room_id,
                 timestamp, user_agent, ip_address, country, device_type, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#
        )
        .bind(&event.id)
        .bind(format!("{:?}", event.event_type))
        .bind(event.user_id)
        .bind(event.persona_id)
        .bind(event.deal_id)
        .bind(event.opportunity_id)
        .bind(event.deal_room_id)
        .bind(event.timestamp)
        .bind(&event.user_agent)
        .bind(&event.ip_address)
        .bind(&event.country)
        .bind(&event.device_type)
        .bind(&event.metadata)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get user conversion funnel: signup → first deal → repeat deal
    pub async fn get_user_funnel(
        &self,
        user_id: i64,
    ) -> Result<UserFunnel, sqlx::Error> {
        let signup_at: Option<DateTime<Utc>> = sqlx::query_scalar(
            "SELECT MIN(timestamp) FROM analytics_events WHERE user_id = $1 AND event_type = 'user_signup'"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        let first_application_at: Option<DateTime<Utc>> = sqlx::query_scalar(
            "SELECT MIN(timestamp) FROM analytics_events WHERE user_id = $1 AND event_type = 'opportunity_apply'"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        let first_deal_completed_at: Option<DateTime<Utc>> = sqlx::query_scalar(
            "SELECT MIN(timestamp) FROM analytics_events WHERE user_id = $1 AND event_type = 'deal_completed'"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        let repeat_deal_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT deal_id) FROM analytics_events WHERE user_id = $1 AND event_type = 'deal_completed'"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(UserFunnel {
            user_id,
            signup_at,
            first_application_at,
            first_deal_completed_at,
            repeat_deal_count,
            time_to_first_application: first_application_at
                .and_then(|app| signup_at.map(|sig| (app - sig).num_hours())),
            time_to_first_deal: first_deal_completed_at
                .and_then(|deal| signup_at.map(|sig| (deal - sig).num_hours())),
        })
    }

    /// Get daily active users
    pub async fn get_dau(&self, date: chrono::NaiveDate) -> Result<i64, sqlx::Error> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(DISTINCT user_id)
            FROM analytics_events
            WHERE DATE(timestamp) = $1
            "#
        )
        .bind(date)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    /// Get opportunity-to-deal conversion rate
    pub async fn get_opportunity_conversion(&self) -> Result<ConversionMetric, sqlx::Error> {
        let opportunities_created: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM analytics_events WHERE event_type = 'opportunity_create'"
        )
        .fetch_one(&self.pool)
        .await?;

        let applications: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM analytics_events WHERE event_type = 'opportunity_apply'"
        )
        .fetch_one(&self.pool)
        .await?;

        let deals_completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM analytics_events WHERE event_type = 'deal_completed'"
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(ConversionMetric {
            opportunities_created,
            applications,
            application_rate: if opportunities_created > 0 {
                (applications as f64 / opportunities_created as f64) * 100.0
            } else {
                0.0
            },
            deals_completed,
            deal_completion_rate: if applications > 0 {
                (deals_completed as f64 / applications as f64) * 100.0
            } else {
                0.0
            },
        })
    }

    /// Get platform GMV (Gross Merchandise Volume) from completed deals
    pub async fn get_gmv_metrics(&self) -> Result<GmvMetrics, sqlx::Error> {
        #[derive(sqlx::FromRow)]
        struct GmvRow {
            total_deals: i64,
            total_volume: Option<i64>,
            avg_deal_size: Option<i64>,
        }

        let row: GmvRow = sqlx::query_as(
            r#"
            SELECT
                COUNT(*) as total_deals,
                SUM(CAST(reward_amount AS BIGINT)) as total_volume,
                AVG(CAST(reward_amount AS BIGINT)) as avg_deal_size
            FROM (
                SELECT DISTINCT deal_id, opportunity_id
                FROM analytics_events
                WHERE event_type = 'deal_completed'
            ) completed
            JOIN opportunities o ON completed.opportunity_id = o.id
            "#
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(GmvMetrics {
            total_deals: row.total_deals,
            total_gmv: row.total_volume.unwrap_or(0),
            average_deal_size: row.avg_deal_size.unwrap_or(0),
            platform_fee_5pct: (row.total_volume.unwrap_or(0) as f64 * 0.05) as i64,
        })
    }

    /// Get top creators by deal volume
    pub async fn get_top_creators(&self, limit: i64) -> Result<Vec<CreatorMetric>, sqlx::Error> {
        let creators = sqlx::query_as::<_, CreatorMetric>(
            r#"
            SELECT
                user_id,
                COUNT(DISTINCT deal_id) as deal_count,
                COUNT(DISTINCT opportunity_id) as opportunity_count,
                SUM(CAST(reward_amount AS BIGINT)) as total_earned
            FROM analytics_events ae
            LEFT JOIN opportunities o ON ae.opportunity_id = o.id
            WHERE ae.event_type = 'deal_completed'
            GROUP BY ae.user_id
            ORDER BY total_earned DESC
            LIMIT $1
            "#
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(creators)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFunnel {
    pub user_id: i64,
    pub signup_at: Option<DateTime<Utc>>,
    pub first_application_at: Option<DateTime<Utc>>,
    pub first_deal_completed_at: Option<DateTime<Utc>>,
    pub repeat_deal_count: i64,
    pub time_to_first_application: Option<i64>, // hours
    pub time_to_first_deal: Option<i64>, // hours
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionMetric {
    pub opportunities_created: i64,
    pub applications: i64,
    pub application_rate: f64,
    pub deals_completed: i64,
    pub deal_completion_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmvMetrics {
    pub total_deals: i64,
    pub total_gmv: i64,
    pub average_deal_size: i64,
    pub platform_fee_5pct: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CreatorMetric {
    pub user_id: i64,
    pub deal_count: i64,
    pub opportunity_count: i64,
    pub total_earned: Option<i64>,
}
