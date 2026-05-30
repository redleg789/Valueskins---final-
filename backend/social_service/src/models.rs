use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Post {
    pub id: Uuid,
    pub author_persona_id: i64,
    pub content: String,
    pub media_urls: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct CreatePostRequest {
    pub author_persona_id: i64,
    pub content: String,
    pub media_urls: Option<Vec<String>>,
}
