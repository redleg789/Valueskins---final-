use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Brand {
    pub id: Uuid,
    pub name: String,
    pub category: String,
    pub min_score: i32,
    pub budget_range: Option<String>,
    pub created_at: DateTime<Utc>,
}
