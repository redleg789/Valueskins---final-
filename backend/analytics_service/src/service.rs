use sqlx::PgPool;
use uuid::Uuid;
use crate::model::CreateEventRequest;

pub struct AnalyticsService {
    pool: PgPool,
}

impl AnalyticsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn log_event(&self, req: CreateEventRequest) -> Result<(), sqlx::Error> {
        let meta = req.metadata.unwrap_or(serde_json::json!({}));
        
        sqlx::query(
            r#"
            INSERT INTO analytics_events (id, event_type, user_id, persona_id, metadata)
            VALUES ($1, $2, $3, $4, $5)
            "#
        )
        .bind(Uuid::new_v4())
        .bind(req.event_type)
        .bind(req.user_id)
        .bind(req.persona_id)
        .bind(meta)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
}
