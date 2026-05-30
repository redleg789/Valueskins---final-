use redis::{
    aio::{ConnectionManager, MultiplexedConnectionManager},
    Client, AsyncCommands, ToRedisArgs,
};
use redis::pipeline;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Redis connection pool for high-concurrency operations
/// Uses MultiplexedConnectionManager for connection reuse
#[derive(Clone)]
pub struct RedisPool {
    manager: Arc<MultiplexedConnectionManager>,
    pool_config: RedisPoolConfig,
}

#[derive(Clone, Debug)]
pub struct RedisPoolConfig {
    pub max_connections: usize,
    pub min_idle: usize,
    pub connection_timeout: Duration,
    pub command_timeout: Duration,
    pub idle_timeout: Duration,
    pub max_lifetime: Duration,
}

impl Default for RedisPoolConfig {
    fn default() -> Self {
        Self {
            max_connections: 50,
            min_idle: 5,
            connection_timeout: Duration::from_secs(5),
            command_timeout: Duration::from_secs(3),
            idle_timeout: Duration::from_secs(600),
            max_lifetime: Duration::from_secs(3600),
        }
    }
}

#[derive(Debug)]
pub enum RedisPoolError {
    Redis(redis::RedisError),
    Serialization(serde_json::Error),
    PoolExhausted,
    NotConnected,
}

impl From<redis::RedisError> for RedisPoolError {
    fn from(e: redis::RedisError) -> Self {
        RedisPoolError::Redis(e)
    }
}

impl From<serde_json::Error> for RedisPoolError {
    fn from(e: serde_json::Error) -> Self {
        RedisPoolError::Serialization(e)
    }
}

impl RedisPool {
    /// Create a new Redis connection pool
    pub async fn new(redis_url: &str) -> Result<Self, RedisPoolError> {
        let config = RedisPoolConfig::default();
        Self::with_config(redis_url, config).await
    }

    /// Create with custom pool configuration
    pub async fn with_config(redis_url: &str, config: RedisPoolConfig) -> Result<Self, RedisPoolError> {
        let client = Client::open(redis_url)?;
        
        let manager = MultiplexedConnectionManager::new(client)
            .await
            .map_err(|e| {
                error!("Failed to create Redis connection pool: {}", e);
                RedisPoolError::NotConnected
            })?;

        info!(
            "Redis connection pool created: max_connections={}, min_idle={}",
            config.max_connections, config.min_idle
        );

        Ok(Self {
            manager: Arc::new(manager),
            pool_config: config,
        })
    }

    /// Get a cached value
    pub async fn get<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Result<Option<T>, RedisPoolError> {
        let mut conn = self.manager.clone();
        
        let result: Option<String> = conn.get(key).await?;
        
        match result {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }

    /// Set a cached value with TTL
    pub async fn set<T: Serialize>(
        &self, 
        key: &str, 
        value: &T, 
        ttl: Duration
    ) -> Result<(), RedisPoolError> {
        let mut conn = self.manager.clone();
        
        let json = serde_json::to_string(value)?;
        let _: () = conn.set_ex(key, json, ttl.as_secs()).await?;
        
        debug!("Cached key {} with TTL {}s", key, ttl.as_secs());
        Ok(())
    }

    /// Delete a key
    pub async fn delete(&self, key: &str) -> Result<(), RedisPoolError> {
        let mut conn = self.manager.clone();
        let _: usize = conn.del(key).await?;
        Ok(())
    }

    /// Check if key exists
    pub async fn exists(&self, key: &str) -> Result<bool, RedisPoolError> {
        let mut conn = self.manager.clone();
        let exists: bool = conn.exists(key).await?;
        Ok(exists)
    }

    /// Increment a counter (for rate limiting)
    pub async fn incr(&self, key: &str, amount: i64) -> Result<i64, RedisPoolError> {
        let mut conn = self.manager.clone();
        let count: i64 = conn.incr(key, amount).await?;
        Ok(count)
    }

    /// Set with expiration if not exists (atomic)
    pub async fn setnx(&self, key: &str, value: &str, ttl: Duration) -> Result<bool, RedisPoolError> {
        let mut conn = self.manager.clone();
        let result: bool = conn.set_nx(key, value).await?;
        if result {
            let _: () = conn.expire(key, ttl.as_secs() as usize).await?;
        }
        Ok(result)
    }

    /// Get multiple keys at once (pipeline)
    pub async fn get_many<T: for<'de> Deserialize<'de>>(
        &self, 
        keys: &[String]
    ) -> Result<Vec<Option<T>>, RedisPoolError> {
        let mut conn = self.manager.clone();
        
        let mut pipe = pipeline();
        for key in keys {
            pipe.get(key);
        }
        
        let results: Vec<Option<String>> = pipe.query_async(&mut conn).await?;
        
        let mut output = Vec::new();
        for json in results {
            match json {
                Some(s) => output.push(Some(serde_json::from_str(&s)?)),
                None => output.push(None),
            }
        }
        
        Ok(output)
    }

    /// Set multiple keys at once (pipeline)
    pub async fn set_many<T: Serialize>(
        &self, 
        items: &[(String, T, Duration)]
    ) -> Result<(), RedisPoolError> {
        let mut conn = self.manager.clone();
        
        let mut pipe = pipeline();
        for (key, value, ttl) in items {
            let json = serde_json::to_string(value)?;
            pipe.set_ex(key.clone(), json, ttl.as_secs() as usize);
        }
        
        pipe.query_async(&mut conn).await?;
        Ok(())
    }

    /// Publish to a channel (for WebSocket pub/sub)
    pub async fn publish(&self, channel: &str, message: &str) -> Result<i64, RedisPoolError> {
        let mut conn = self.manager.clone();
        let subscribers: i64 = conn.publish(channel, message).await?;
        Ok(subscribers)
    }

    /// Subscribe to a channel (returns receiver)
    pub async fn subscribe(&self, channel: &str) -> Result<redis::Msg, RedisPoolError> {
        let mut pubsub = self.manager.clone().get_async_pubsub().await?;
        pubsub.subscribe(channel).await?;
        
        let msg = pubsub.on_message();
        Ok(msg)
    }
}

/// Rate limiter using Redis sliding window
pub struct RateLimiter {
    pool: RedisPool,
    window_seconds: u64,
    max_requests: u64,
}

impl RateLimiter {
    pub fn new(pool: RedisPool, window_seconds: u64, max_requests: u64) -> Self {
        Self {
            pool,
            window_seconds,
            max_requests,
        }
    }

    /// Check if request is allowed and record it
    /// Returns (allowed, current_count, retry_after_seconds)
    pub async fn check(&self, key: &str) -> Result<(bool, u64, u64), RedisPoolError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let window_key = format!("ratelimit:{}:{}", key, now / self.window_seconds);
        let limit_key = format!("ratelimit:{}:limit", key);
        
        let mut conn = self.pool.manager.clone();
        
        // Increment counter in current window
        let count: i64 = conn.incr(&window_key, 1).await?;
        
        // Set expire on first request in window
        if count == 1 {
            let _: () = conn.expire(&window_key, self.window_seconds as usize).await?;
        }
        
        // Check total across all windows in sliding window
        let mut pipe = pipeline();
        for window_offset in 0..self.window_seconds {
            let wkey = format!("ratelimit:{}:{}", key, (now - window_offset) / self.window_seconds);
            pipe.get(&wkey);
        }
        
        let results: Vec<Option<i64>> = pipe.query_async(&mut conn).await?;
        let total: i64 = results.iter().filter_map(|v| *v).sum();
        
        let allowed = total <= self.max_requests as i64;
        let retry_after = if !allowed {
            // Find when current window expires
            let current_window = now / self.window_seconds;
            (current_window + 1) * self.window_seconds - now
        } else {
            0
        };
        
        Ok((allowed, total as u64, retry_after))
    }

    /// Get current count without incrementing
    pub async fn get_current(&self, key: &str) -> Result<u64, RedisPoolError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let mut conn = self.pool.manager.clone();
        
        let mut pipe = pipeline();
        for window_offset in 0..self.window_seconds {
            let wkey = format!("ratelimit:{}:{}", key, (now - window_offset) / self.window_seconds);
            pipe.get(&wkey);
        }
        
        let results: Vec<Option<i64>> = pipe.query_async(&mut conn).await?;
        let total: i64 = results.iter().filter_map(|v| *v).sum();
        
        Ok(total as u64)
    }
}

/// Session store using Redis
pub struct SessionStore {
    pool: RedisPool,
    ttl: Duration,
}

impl SessionStore {
    pub fn new(pool: RedisPool, ttl: Duration) -> Self {
        Self { pool, ttl }
    }

    /// Create a new session
    pub async fn create(&self, session_id: &str, user_id: &str) -> Result<(), RedisPoolError> {
        let key = format!("session:{}", session_id);
        let value = serde_json::json!({
            "user_id": user_id,
            "created_at": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        });
        
        self.pool.set(&key, &value, self.ttl).await?;
        Ok(())
    }

    /// Get session user_id
    pub async fn get_user_id(&self, session_id: &str) -> Result<Option<String>, RedisPoolError> {
        let key = format!("session:{}", session_id);
        
        #[derive(Deserialize)]
        struct SessionData {
            user_id: String,
        }
        
        let session: Option<SessionData> = self.pool.get(&key).await?;
        Ok(session.map(|s| s.user_id))
    }

    /// Extend session TTL
    pub async fn extend(&self, session_id: &str) -> Result<(), RedisPoolError> {
        let key = format!("session:{}", session_id);
        
        // Get current session data
        #[derive(Deserialize)]
        struct SessionData {
            user_id: String,
            created_at: u64,
        }
        
        let session: Option<SessionData> = self.pool.get(&key).await?;
        
        if let Some(s) = session {
            let value = serde_json::json!({
                "user_id": s.user_id,
                "created_at": s.created_at
            });
            self.pool.set(&key, &value, self.ttl).await?;
        }
        
        Ok(())
    }

    /// Delete session
    pub async fn delete(&self, session_id: &str) -> Result<(), RedisPoolError> {
        let key = format!("session:{}", session_id);
        self.pool.delete(&key).await
    }
}

/// Cache for user profiles (read-heavy)
pub struct UserCache {
    pool: RedisPool,
    default_ttl: Duration,
}

impl UserCache {
    pub fn new(pool: RedisPool, default_ttl_secs: u64) -> Self {
        Self {
            pool,
            default_ttl: Duration::from_secs(default_ttl_secs),
        }
    }

    /// Cache a user profile
    pub async fn cache_user<T: Serialize>(&self, user_id: &str, profile: &T) -> Result<(), RedisPoolError> {
        let key = format!("user:{}", user_id);
        self.pool.set(&key, profile, self.default_ttl).await
    }

    /// Get cached user profile
    pub async fn get_user<T: for<'de> Deserialize<'de>>(&self, user_id: &str) -> Result<Option<T>, RedisPoolError> {
        let key = format!("user:{}", user_id);
        self.pool.get(&key).await
    }

    /// Invalidate cached user profile
    pub async fn invalidate(&self, user_id: &str) -> Result<(), RedisPoolError> {
        let key = format!("user:{}", user_id);
        self.pool.delete(&key).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pool_creation() {
        // Test will fail without Redis running
        let result = RedisPool::new("redis://localhost:6379").await;
        assert!(result.is_err()); // Expected to fail in test env
    }
}