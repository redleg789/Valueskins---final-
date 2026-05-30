//! Real-time messaging with polling support
//! Clients poll for new messages every 2-5 seconds
//! WebSocket upgrade available in Phase 2

use sqlx::PgPool;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Message {
    pub id: String,
    pub deal_room_id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRequest {
    pub deal_room_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollMessagesResponse {
    pub messages: Vec<Message>,
    pub has_unread: bool,
    pub unread_count: i32,
}

pub struct MessageService {
    pool: PgPool,
}

impl MessageService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Post a message to a deal room
    pub async fn send_message(
        &self,
        sender_id: &str,
        sender_name: &str,
        req: MessageRequest,
    ) -> Result<Message, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        sqlx::query_as::<_, Message>(
            r#"
            INSERT INTO messages (id, deal_room_id, sender_id, sender_name, content, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, deal_room_id, sender_id, sender_name, content, created_at, read_at
            "#
        )
        .bind(&id)
        .bind(&req.deal_room_id)
        .bind(sender_id)
        .bind(sender_name)
        .bind(&req.content)
        .bind(now)
        .fetch_one(&self.pool)
        .await
    }

    /// Get messages for polling
    /// Returns all messages since last_message_id, or recent 50 if first poll
    pub async fn get_messages_for_polling(
        &self,
        deal_room_id: &str,
        viewer_id: &str,
        since_message_id: Option<&str>,
        limit: i32,
    ) -> Result<PollMessagesResponse, sqlx::Error> {
        // Fetch messages
        let messages: Vec<Message> = if let Some(msg_id) = since_message_id {
            sqlx::query_as(
                "SELECT id, deal_room_id, sender_id, sender_name, content, created_at, read_at FROM messages WHERE deal_room_id = $1 AND id > $2 ORDER BY created_at DESC LIMIT $3"
            )
            .bind(deal_room_id)
            .bind(msg_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as(
                "SELECT id, deal_room_id, sender_id, sender_name, content, created_at, read_at FROM messages WHERE deal_room_id = $1 ORDER BY created_at DESC LIMIT $2"
            )
            .bind(deal_room_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?
        };

        // Count unread for this viewer
        let unread_count: (Option<i64>,) = sqlx::query_as(
            "SELECT COUNT(*) FROM messages WHERE deal_room_id = $1 AND sender_id != $2 AND read_at IS NULL"
        )
        .bind(deal_room_id)
        .bind(viewer_id)
        .fetch_one(&self.pool)
        .await?;

        let unread_count = unread_count.0.unwrap_or(0) as i32;
        let has_unread = unread_count > 0;

        Ok(PollMessagesResponse {
            messages,
            has_unread,
            unread_count,
        })
    }

    /// Mark messages as read
    pub async fn mark_as_read(
        &self,
        deal_room_id: &str,
        viewer_id: &str,
    ) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            "UPDATE messages SET read_at = NOW() WHERE deal_room_id = $1 AND sender_id != $2 AND read_at IS NULL"
        )
        .bind(deal_room_id)
        .bind(viewer_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected())
    }

    /// Get unread count for user across all deal rooms
    pub async fn get_unread_count(&self, user_id: &str) -> Result<i32, sqlx::Error> {
        let count: (Option<i64>,) = sqlx::query_as(
            "SELECT COUNT(*) FROM messages m JOIN deal_rooms dr ON m.deal_room_id = dr.id WHERE (dr.creator_id = $1 OR dr.brand_id = $1) AND m.sender_id != $1 AND m.read_at IS NULL"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0.unwrap_or(0) as i32)
    }

    /// Delete message (soft delete with timestamp)
    pub async fn delete_message(&self, message_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE messages SET deleted_at = NOW() WHERE id = $1")
            .bind(message_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}
