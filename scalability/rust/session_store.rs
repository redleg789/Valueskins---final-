// Distributed Session Management for 100K users
// Uses Redis for session storage + distributed cache invalidation

use std::time::Duration;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::redis_pool::{RedisPool, RedisPoolError};

const SESSION_PREFIX: &str = "session:";
const SESSION_TTL: Duration = Duration::from_secs(3600); // 1 hour
const SESSION_REFRESH_TTL: Duration = Duration::from_secs(300);  // 5 minutes

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub user_id: i64,
    pub email: String,
    pub username: String,
    pub role: SessionRole,
    pub created_at: i64,
    pub last_refreshed: i64,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionRole {
    Admin,
    Creator,
    Brand,
    User,
    Guest,
}

impl Default for SessionRole {
    fn default() -> Self {
        SessionRole::Guest
    }
}

impl Session {
    pub fn new(user_id: i64, email: &str, username: &str) -> Self {
        let now = chrono::Utc::now().timestamp();
        
        Self {
            user_id,
            email: email.to_string(),
            username: username.to_string(),
            role: SessionRole::User,
            created_at: now,
            last_refreshed: now,
            ip_address: None,
            user_agent: None,
            metadata: serde_json::Value::Null,
        }
    }

    pub fn is_admin(&self) -> bool {
        self.role == SessionRole::Admin
    }

    pub fn is_creator(&self) -> bool {
        matches!(self.role, SessionRole::Creator | SessionRole::Admin)
    }

    pub fn is_brand(&self) -> bool {
        matches!(self.role, SessionRole::Brand | SessionRole::Admin)
    }

    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        now - self.last_refreshed > SESSION_TTL.as_secs() as i64
    }
}

/// Distributed session store using Redis
pub struct SessionStore {
    redis: RedisPool,
    local_cache: Arc<RwLock<std::collections::HashMap<String, Session>>>,
}

impl SessionStore {
    pub fn new(redis: RedisPool) -> Self {
        Self {
            redis,
            local_cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    /// Create new session
    pub async fn create(&self, session_id: &str, session: &Session) -> Result<(), SessionError> {
        let key = format!("{}{}", SESSION_PREFIX, session_id);
        
        // Store in Redis
        let json = serde_json::to_vec(session)
            .map_err(|_| SessionError::SerializationError)?;
        
        let json_str = String::from_utf8(json)
            .map_err(|_| SessionError::SerializationError)?;
        
        self.redis.set(&key, &json_str, SESSION_TTL).await?;
        
        // Also store in local cache for fast access
        let mut cache = self.local_cache.write().await;
        cache.insert(session_id.to_string(), session.clone());
        
        tracing::debug!("Session created for user {}", session.user_id);
        
        Ok(())
    }

    /// Get session
    pub async fn get(&self, session_id: &str) -> Result<Option<Session>, SessionError> {
        // Check local cache first
        {
            let cache = self.local_cache.read().await;
            if let Some(session) = cache.get(session_id) {
                if !session.is_expired() {
                    return Ok(Some(session.clone()));
                }
            }
        }
        
        // Get from Redis
        let key = format!("{}{}", SESSION_PREFIX, session_id);
        let result: Option<String> = self.redis.get(&key).await?;
        
        match result {
            Some(json) => {
                let session: Session = serde_json::from_str(&json)
                    .map_err(|_| SessionError::SerializationError)?;
                
                // Skip expired
                if session.is_expired() {
                    return Ok(None);
                }
                
                // Update local cache
                let mut cache = self.local_cache.write().await;
                cache.insert(session_id.to_string(), session.clone());
                
                Ok(Some(session))
            }
            None => Ok(None),
        }
    }

    /// Refresh session TTL
    pub async fn refresh(&self, session_id: &str) -> Result<(), SessionError> {
        let key = format!("{}{}", SESSION_PREFIX, session_id);
        
        // Extend in Redis
        self.redis.setnx(&key, "", SESSION_TTL).await?;
        
        // Update last_refreshed
        if let Some(session) = self.get(session_id).await? {
            let mut session = session;
            session.last_refreshed = chrono::Utc::now().timestamp();
            
            let json = serde_json::to_string(&session)
                .map_err(|_| SessionError::SerializationError)?;
            
            self.redis.set(&key, &json, SESSION_TTL).await?;
            
            // Update local cache
            let mut cache = self.local_cache.write().await;
            cache.insert(session_id.to_string(), session);
        }
        
        Ok(())
    }

    /// Delete session
    pub async fn delete(&self, session_id: &str) -> Result<(), SessionError> {
        let key = format!("{}{}", SESSION_PREFIX, session_id);
        
        // Remove from Redis
        self.redis.delete(&key).await?;
        
        // Remove from local cache
        let mut cache = self.local_cache.write().await;
        cache.remove(session_id);
        
        tracing::debug!("Session deleted: {}", session_id);
        
        Ok(())
    }

    /// Invalidate all sessions for a user (logout everywhere)
    pub async fn invalidate_user(&self, user_id: i64) -> Result<(), SessionError> {
        let pattern = format!("{}*", SESSION_PREFIX);
        let mut conn = self.redis.manager.clone();
        
        // SCAN for all session keys
        let mut scan = redis::cmd("SCAN")
            .arg(0)
            .arg("MATCH")
            .arg(&pattern)
            .iter_async(&mut conn);
        
        let mut to_delete = Vec::new();
        
        while let Ok(Some(keys)) = scan.next_item().await {
            for key in keys {
                to_delete.push(key);
            }
        }
        
        // Delete all matching sessions
        for key in to_delete {
            let _: () = redis::cmd("DEL")
                .arg(&key)
                .query_async(&mut conn).await?;
        }
        
        // Clear local cache
        let mut cache = self.local_cache.write().await;
        cache.retain(|_, session| session.user_id != user_id);
        
        tracing::info!("Invalidated all sessions for user {}", user_id);
        
        Ok(())
    }

    /// Get all active sessions (for admin)
    pub async fn list_sessions(&self, limit: usize) -> Result<Vec<(String, Session)>, SessionError> {
        let pattern = format!("{}*", SESSION_PREFIX);
        let mut conn = self.redis.manager.clone();
        
        let mut sessions = Vec::new();
        let mut scan = redis::cmd("SCAN")
            .arg(0)
            .arg("MATCH")
            .arg(&pattern)
            .arg("COUNT")
            .arg(100)
            .iter_async(&mut conn);
        
        while let Ok(Some(keys)) = scan.next_item().await {
            for key in keys {
                if sessions.len() >= limit {
                    break;
                }
                
                let value: String = redis::cmd("GET")
                    .arg(&key)
                    .query_async(&mut conn)
                    .await?;
                
                if let Ok(session) = serde_json::from_str::<Session>(&value) {
                    let session_id = key.strip_prefix(SESSION_PREFIX).unwrap_or(&key);
                    sessions.push((session_id.to_string(), session));
                }
            }
        }
        
        Ok(sessions)
    }

    /// Cleanup expired sessions (run periodically)
    pub async fn cleanup(&self) -> Result<usize, SessionError> {
        // Local cache grows unbounded, clean old entries
        let mut cache = self.local_cache.write().await;
        
        let before = cache.len();
        cache.retain(|_, session| !session.is_expired());
        let cleaned = before - cache.len();
        
        if cleaned > 0 {
            tracing::info!("Cleaned {} expired sessions from local cache", cleaned);
        }
        
        Ok(cleaned)
    }

    /// Get session count (for monitoring)
    pub async fn count(&self) -> Result<usize, SessionError> {
        let pattern = format!("{}*", SESSION_PREFIX);
        let mut conn = self.redis.manager.clone();
        
        let count: i64 = redis::cmd("SCAN")
            .arg(0)
            .arg("MATCH")
            .arg(&pattern)
            .arg("COUNT")
            .arg(10000)
            .iter_async(&mut conn)
            .count() as i64;
        
        Ok(count as usize)
    }
}

#[derive(Debug)]
pub enum SessionError {
    NotFound,
    Expired,
    SerializationError,
    RedisError(RedisPoolError),
}

impl std::fmt::Display for SessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionError::NotFound => write!(f, "Session not found"),
            SessionError::Expired => write!(f, "Session expired"),
            SessionError::SerializationError => write!(f, "Serialization error"),
            SessionError::RedisError(e) => write!(f, "Redis error: {}", e),
        }
    }
}

impl std::error::Error for SessionError {}

impl From<RedisPoolError> for SessionError {
    fn from(e: RedisPoolError) -> Self {
        SessionError::RedisError(e)
    }
}