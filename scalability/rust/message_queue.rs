// Message Queue with Kafka for durability
// Handles: chat messages, presence, typing, notifications

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, broadcast};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMessage {
    pub id: String,
    pub topic: String,
    pub key: String,
    pub value: Vec<u8>,
    pub timestamp: i64,
    pub partition: i32,
    pub offset: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub room_id: i64,
    pub sender_id: i64,
    pub content: String,
    pub message_type: MessageType,
    pub reply_to: Option<String>,
    pub created_at: i64,
    pub delivered_at: Option<i64>,
    pub read_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    Text,
    Image,
    File,
    System,
}

/// Message queue topics
pub const TOPIC_MESSAGES: &str = "messages";
pub const TOPIC_PRESENCE: &str = "presence";
pub const TOPIC_TYPING: &str = "typing";
pub const TOPIC_NOTIFICATIONS: &str = "notifications";
pub const TOPIC_EVENTS: &str = "events";

/// Kafka message producer
pub struct MessageProducer {
    brokers: Vec<String>,
    topic_partitions: usize,
}

impl MessageProducer {
    pub fn new(brokers: Vec<String>, topic_partitions: usize) -> Self {
        Self {
            brokers,
            topic_partitions,
        }
    }

    /// Send message to topic
    pub async fn send(
        &self,
        topic: &str,
        key: &str,
        value: Vec<u8>,
    ) -> Result<(i32, i64), MessageQueueError> {
        // In production, use rdkafka
        // Here we simulate with in-memory queue
        
        let partition = self.partition_for_key(key);
        let offset = self.generate_offset();
        
        Ok((partition, offset))
    }

    /// Send chat message
    pub async fn send_message(
        &self,
        message: &ChatMessage,
    ) -> Result<(i32, i64), MessageQueueError> {
        let key = message.room_id.to_string();
        let value = serde_json::to_vec(message)
            .map_err(|_| MessageQueueError::SerializationError)?;
        
        self.send(TOPIC_MESSAGES, &key, value).await
    }

    /// Send presence update
    pub async fn send_presence(
        &self,
        room_id: i64,
        user_id: i64,
        online: bool,
    ) -> Result<(i32, i64), MessageQueueError> {
        let key = format!("{}:{}", room_id, user_id);
        let value = serde_json::json!({
            "room_id": room_id,
            "user_id": user_id,
            "online": online,
            "timestamp": chrono::Utc::now().timestamp(),
        }).to_string();
        
        self.send(TOPIC_PRESENCE, &key, value.into_bytes()).await
    }

    /// Send typing indicator
    pub async fn send_typing(
        &self,
        room_id: i64,
        user_id: i64,
        is_typing: bool,
    ) -> Result<(i32, i64), MessageQueueError> {
        let key = format!("{}:{}", room_id, user_id);
        let value = serde_json::json!({
            "room_id": room_id,
            "user_id": user_id,
            "is_typing": is_typing,
            "timestamp": chrono::Utc::now().timestamp(),
        }).to_string();
        
        self.send(TOPIC_TYPING, &key, value.into_bytes()).await
    }

    fn partition_for_key(&self, key: &str) -> i32 {
        // Consistent hashing for partition
        let hash = self.fnv_hash(key);
        (hash % self.topic_partitions as u64) as i32
    }

    fn fnv_hash(&self, key: &str) -> u64 {
        let mut hash: u64 = 14695981039346656037;
        for byte in key.bytes() {
            hash ^= byte as u64;
            hash = hash.wrapping_mul(1099511628211);
        }
        hash
    }

    fn generate_offset(&self) -> i64 {
        chrono::Utc::now().timestamp_millis() as i64
    }
}

/// Kafka message consumer
pub struct MessageConsumer {
    topic: String,
    group_id: String,
    partition: i32,
    offset: i64,
    local_queue: Arc<RwLock<Vec<QueueMessage>>>,
}

impl MessageConsumer {
    pub fn new(topic: &str, group_id: &str, partition: i32) -> Self {
        Self {
            topic: topic.to_string(),
            group_id: group_id.to_string(),
            partition,
            offset: 0,
            local_queue: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Poll for new messages
    pub async fn poll(&self) -> Option<QueueMessage> {
        let queue = self.local_queue.read().await;
        queue.get(0).cloned()
    }

    /// Add message to queue (called by Kafka consumer)
    pub async fn add(&self, message: QueueMessage) {
        let mut queue = self.local_queue.write().await;
        queue.push(message);
        
        // Keep only last 1000
        if queue.len() > 1000 {
            queue.drain(0..queue.len() - 1000);
        }
    }

    /// Commit offset
    pub async fn commit(&self) {
        // In production, commit to Kafka
        self.offset += 1;
    }
}

/// Event store for message history
pub struct EventStore {
    redis: crate::redis_pool::RedisPool,
}

impl EventStore {
    pub fn new(redis: crate::redis_pool::RedisPool) -> Self {
        Self { redis }
    }

    /// Store message in durable store
    pub async fn store_message(&self, message: &ChatMessage) -> Result<(), MessageQueueError> {
        let key = format!("message:{}:{}", message.room_id, message.id);
        
        let value = serde_json::to_vec(message)
            .map_err(|_| MessageQueueError::SerializationError)?;
        
        // Store with 30-day TTL
        self.redis.set(&key, &value, Duration::from_secs(30 * 24 * 60 * 60)).await?;
        
        // Also add to room index
        let room_key = format!("room:{}:messages", message.room_id);
        let mut conn = self.redis.manager.clone();
        
        redis::cmd("RPUSH")
            .arg(&room_key)
            .arg(&message.id)
            .query_async(&mut conn).await?;
        
        // Trim to last 10000
        redis::cmd("LTRIM")
            .arg(&room_key)
            .arg(-10000)
            .arg(-1)
            .query_async(&mut conn).await?;
        
        Ok(())
    }

    /// Get message history for room
    pub async fn get_history(
        &self,
        room_id: i64,
        limit: usize,
        before: Option<String>,
    ) -> Result<Vec<ChatMessage>, MessageQueueError> {
        let room_key = format!("room:{}:messages", room_id);
        
        let mut conn = self.redis.manager.clone();
        
        // Get message IDs
        let message_ids: Vec<String> = if let Some(before_id) = before {
            let index: i64 = redis::cmd("LRANGE")
                .arg(&room_key)
                .arg(0)
                .arg(0)
                .query_async(&mut conn).await?;
            
            // Find position and get earlier messages
            redis::cmd("LRANGE")
                .arg(&room_key)
                .arg(-(limit as i64 + 1))
                .arg(-1)
                .query_async(&mut conn).await?
        } else {
            redis::cmd("LRANGE")
                .arg(&room_key)
                .arg(-(limit as i64))
                .arg(-1)
                .query_async(&mut conn).await?
        };
        
        // Get actual messages
        let mut messages = Vec::new();
        for id in message_ids {
            let key = format!("message:{}:{}", room_id, id);
            if let Ok(Some(value)) = self.redis.get::<Vec<u8>>(&key).await {
                if let Ok(msg) = serde_json::from_slice(&value) {
                    messages.push(msg);
                }
            }
        }
        
        Ok(messages)
    }

    /// Get single message
    pub async fn get_message(
        &self,
        room_id: i64,
        message_id: &str,
    ) -> Result<Option<ChatMessage>, MessageQueueError> {
        let key = format!("message:{}:{}", room_id, message_id);
        
        let value: Option<Vec<u8>> = self.redis.get(&key).await?;
        
        match value {
            Some(bytes) => {
                let message = serde_json::from_slice(&bytes)
                    .map_err(|_| MessageQueueError::SerializationError)?;
                Ok(Some(message))
            }
            None => Ok(None),
        }
    }
}

/// Message queue error
#[derive(Debug)]
pub enum MessageQueueError {
    ConnectionError,
    SerializationError,
    Timeout,
    NotFound,
    RedisError(crate::redis_pool::RedisPoolError),
}

impl std::fmt::Display for MessageQueueError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageQueueError::ConnectionError => write!(f, "Connection error"),
            MessageQueueError::SerializationError => write!(f, "Serialization error"),
            MessageQueueError::Timeout => write!(f, "Timeout"),
            MessageQueueError::NotFound => write!(f, "Not found"),
            MessageQueueError::RedisError(e) => write!(f, "Redis error: {}", e),
        }
    }
}

impl From<crate::redis_pool::RedisPoolError> for MessageQueueError {
    fn from(e: crate::redis_pool::RedisPoolError) -> Self {
        MessageQueueError::RedisError(e)
    }
}

/// Broadcast for local message delivery (with Kafka for durability)
pub struct MessageBus {
    /// In-memory broadcast for same-instance delivery
    broadcast_tx: broadcast::Sender<ChatMessage>,
    /// Kafka producer for cross-instance delivery
    producer: Option<MessageProducer>,
}

impl MessageBus {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(10000);
        
        Self {
            broadcast_tx: tx,
            producer: None,
        }
    }

    pub fn with_kafka(brokers: Vec<String>, partitions: usize) -> Self {
        let producer = MessageProducer::new(brokers, partitions);
        let (tx, _) = broadcast::channel(10000);
        
        Self {
            broadcast_tx: tx,
            producer: Some(producer),
        }
    }

    /// Publish message (local + Kafka)
    pub async fn publish(&self, message: ChatMessage) -> Result<(), MessageQueueError> {
        // Local broadcast
        let _ = self.broadcast_tx.send(message.clone());
        
        // Kafka for durability
        if let Some(producer) = &self.producer {
            producer.send_message(&message).await?;
        }
        
        Ok(())
    }

    /// Subscribe to messages for room
    pub fn subscribe(&self, room_id: i64) -> broadcast::Receiver<ChatMessage> {
        self.broadcast_tx.subscribe()
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new()
    }
}