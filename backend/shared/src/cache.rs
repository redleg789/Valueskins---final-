use redis::{aio::ConnectionManager, Client, AsyncCommands};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{error, info, warn};

/// Distributed Cache for Meta-scale deployments
/// Uses connection pooling (ConnectionManager) for high concurrency.
#[derive(Clone)]
pub struct RedisCache {
    pub manager: Option<ConnectionManager>,
}

#[derive(Debug)]
pub enum CacheError {
    Redis(redis::RedisError),
    Serialization(serde_json::Error),
    NotConnected,
}

impl From<redis::RedisError> for CacheError {
    fn from(e: redis::RedisError) -> Self {
        CacheError::Redis(e)
    }
}

impl From<serde_json::Error> for CacheError {
    fn from(e: serde_json::Error) -> Self {
        CacheError::Serialization(e)
    }
}

impl RedisCache {
    /// Initialize connection to Redis
    pub async fn new(redis_url: &str) -> Result<Self, CacheError> {
        let client = Client::open(redis_url)?;

        let manager = match ConnectionManager::new(client).await {
            Ok(mgr) => Some(mgr),
            Err(e) => {
                warn!("Failed to connect to Redis cache. Running in local/degraded mode. Error: {}", e);
                None
            }
        };

        if manager.is_some() {
            info!("Redis Cache ConnectionManager initialized successfully.");
        }

        Ok(Self { manager })
    }

    /// Default degraded cache that just acts as an in-memory pass-through
    pub fn new_disabled() -> Self {
        Self { manager: None }
    }

    /// Read an item from Cache
    pub async fn get<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Result<Option<T>, CacheError> {
        let mut conn = match &self.manager {
            Some(mgr) => mgr.clone(),
            None => return Ok(None), // Fail open if cache is down
        };

        let result: Option<String> = conn.get(key).await?;

        match result {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }

    /// Write an item to Cache with TTL
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Duration) -> Result<(), CacheError> {
        let mut conn = match &self.manager {
            Some(mgr) => mgr.clone(),
            None => return Ok(()), // Fail open
        };

        let json = serde_json::to_string(value)?;
        let _ : () = conn.set_ex(key, json, ttl.as_secs()).await?;
        Ok(())
    }

    /// Delete an item from Cache
    pub async fn delete(&self, key: &str) -> Result<(), CacheError> {
        let mut conn = match &self.manager {
            Some(mgr) => mgr.clone(),
            None => return Ok(()),
        };

        let _ : () = conn.del(key).await?;
        Ok(())
    }
}
