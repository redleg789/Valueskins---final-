// Distributed Cache Invalidation with Pub/Sub
// Notifies all pods when cache changes

use std::sync::Arc;
use tokio::sync::RwLock;
use crate::redis_pool::{RedisPool, RedisPoolError};

const CACHE_INVALIDATION_CHANNEL: &str = "cache:invalidation";

/// Cache invalidation message
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InvalidationMessage {
    pub key: String,
    pub pattern: Option<String>,
    pub user_id: Option<i64>,
    pub timestamp: i64,
}

/// Distributed cache with invalidation
pub struct DistributedCache {
    redis: RedisPool,
    local_cache: Arc<RwLock<std::collections::HashMap<String, (serde_json::Value, i64)>>>,
    subscriber_handle: Arc<RwLock<Option<tokio::task::JoinHandle<()>>>>,
}

impl DistributedCache {
    pub fn new(redis: RedisPool) -> Self {
        Self {
            redis,
            local_cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
            subscriber_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Start listening for invalidation messages
    pub fn start_invalidation_listener(&self) {
        let redis = self.redis.clone();
        let local_cache = self.local_cache.clone();
        
        let handle = tokio::spawn(async move {
            let mut conn = redis.manager.clone();
            
            // Subscribe to invalidation channel
            let mut pubsub = conn.get_async_pubsub().await
                .expect("Failed to create pubsub");
            
            pubsub.subscribe(CACHE_INVALIDATION_CHANNEL).await
                .expect("Failed to subscribe");
            
            let mut stream = pubsub.on_message();
            
            loop {
                if let Ok(msg) = stream.next().await {
                    if let Ok(payload) = msg.get_payload::<String>() {
                        if let Ok(invalidation) = serde_json::from_str::<InvalidationMessage>(&payload) {
                            // Invalidate local cache
                            let mut cache = local_cache.write().await;
                            
                            if let Some(pattern) = &invalidation.pattern {
                                // Pattern-based invalidation
                                let keys: Vec<String> = cache.keys()
                                    .filter(|k| k.starts_with(pattern))
                                    .cloned();
                                for key in keys {
                                    cache.remove(&key);
                                }
                            } else {
                                // Single key invalidation
                                cache.remove(&invalidation.key);
                            }
                            
                            tracing::debug!("Invalidated cache: {:?}", invalidation.key);
                        }
                    }
                }
            }
        });
        
        // Store handle for cleanup
        let subscriber_handle = self.subscriber_handle.clone();
        let mut handle_ref = subscriber_handle.write().await;
        *handle_ref = Some(handle);
    }

    /// Invalidate cache and notify other pods
    pub async fn invalidate(&self, key: &str) -> Result<(), CacheError> {
        // Invalidate in Redis
        self.redis.delete(key).await?;
        
        // Invalidate local cache
        {
            let mut cache = self.local_cache.write().await;
            cache.remove(key);
        }
        
        // Notify other pods via Redis pub/sub
        let message = InvalidationMessage {
            key: key.to_string(),
            pattern: None,
            user_id: None,
            timestamp: chrono::Utc::now().timestamp(),
        };
        
        self.redis.publish(CACHE_INVALIDATION_CHANNEL, &serde_json::to_string(&message).unwrap()).await?;
        
        Ok(())
    }

    /// Invalidate all keys matching pattern
    pub async fn invalidate_pattern(&self, pattern: &str) -> Result<(), CacheError> {
        // Find matching keys in Redis
        let pattern_key = format!("*{}*", pattern);
        let mut conn = self.redis.manager.clone();
        
        let mut keys_to_invalidate = Vec::new();
        let mut scan = redis::cmd("SCAN")
            .arg(0)
            .arg("MATCH")
            .arg(&pattern_key)
            .iter_async(&mut conn);
        
        while let Ok(Some(keys)) = scan.next_item().await {
            for key in keys {
                keys_to_invalidate.push(key);
            }
        }
        
        // Delete from Redis
        for key in &keys_to_invalidate {
            self.redis.delete(key).await?;
        }
        
        // Notify other pods
        let message = InvalidationMessage {
            key: String::new(),
            pattern: Some(pattern.to_string()),
            user_id: None,
            timestamp: chrono::Utc::now().timestamp(),
        };
        
        self.redis.publish(CACHE_INVALIDATION_CHANNEL, &serde_json::to_string(&message).unwrap()).await?;
        
        Ok(())
    }

    /// Invalidate user's cache
    pub async fn invalidate_user(&self, user_id: i64) -> Result<(), CacheError> {
        let key = format!("user:{}", user_id);
        self.invalidate(&key).await
    }
}

/// CRDT for collaborative typing indicators
/// Last-Writer-Wins for simplicity
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TypingIndicator {
    pub room_id: i64,
    pub user_id: i64,
    pub is_typing: bool,
    pub timestamp: i64,
}

impl TypingIndicator {
    pub fn merge(&self, other: &TypingIndicator) -> TypingIndicator {
        // Last writer wins
        if other.timestamp > self.timestamp {
            other.clone()
        } else {
            self.clone()
        }
    }
}

/// CRDT for user presence
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Presence {
    pub room_id: i64,
    pub user_id: i64,
    pub online: bool,
    pub last_seen: i64,
}

impl Presence {
    pub fn merge(&self, other: &Presence) -> Presence {
        // If both online, keep most recent
        // If one offline, prefer online
        match (self.online, other.online) {
            (true, true) => {
                if other.last_seen > self.last_seen {
                    other.clone()
                } else {
                    self.clone()
                }
            }
            (false, true) => other.clone(),
            (true, false) => self.clone(),
            (false, false) => {
                if other.last_seen > self.last_seen {
                    other.clone()
                } else {
                    self.clone()
                }
            }
        }
    }
}

/// Presence set using G-Counter CRDT concept
#[derive(Debug, Clone, Default)]
pub struct PresenceSet {
    entries: std::collections::HashMap<i64, Presence>,
}

impl PresenceSet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, presence: Presence) {
        let user_id = presence.user_id;
        
        if let Some(existing) = self.entries.get(&user_id) {
            self.entries.insert(user_id, existing.merge(&presence));
        } else {
            self.entries.insert(user_id, presence);
        }
    }

    pub fn remove(&mut self, user_id: i64, room_id: i64) {
        let offline = Presence {
            room_id,
            user_id,
            online: false,
            last_seen: chrono::Utc::now().timestamp(),
        };
        self.entries.insert(user_id, offline);
    }

    pub fn get_online(&self) -> Vec<i64> {
        self.entries
            .values()
            .filter(|p| p.online)
            .map(|p| p.user_id)
            .collect()
    }
}

/// Distributed counter for real-time sync
#[derive(Debug, Clone, Default)]
pub struct DistributedCounter {
    value: std::sync::atomic::AtomicI64,
}

impl DistributedCounter {
    pub fn new(initial: i64) -> Self {
        Self {
            value: std::sync::atomic::AtomicI64::new(initial),
        }
    }

    pub fn increment(&self, amount: i64) -> i64 {
        self.value.fetch_add(amount, std::sync::atomic::Ordering::SeqCst) + amount
    }

    pub fn decrement(&self, amount: i64) -> i64 {
        self.value.fetch_sub(amount, std::sync::atomic::Ordering::SeqCst) - amount
    }

    pub fn get(&self) -> i64 {
        self.value.load(std::sync::atomic::Ordering::SeqCst)
    }
}

#[derive(Debug)]
pub enum CacheError {
    RedisError(RedisPoolError),
    InvalidationFailed,
}

impl std::fmt::Display for CacheError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CacheError::RedisError(e) => write!(f, "Redis error: {}", e),
            CacheError::InvalidationFailed => write!(f, "Invalidation failed"),
        }
    }
}

impl From<RedisPoolError> for CacheError {
    fn from(e: RedisPoolError) -> Self {
        CacheError::RedisError(e)
    }
}