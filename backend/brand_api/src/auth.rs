//! Brand API Authentication
//! 
//! API key based authentication for brand integrations

use actix_web::{dev::ServiceRequest, Error, HttpMessage};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::PgPool;
use std::env;

type HmacSha256 = Hmac<Sha256>;

/// Validates API key and returns brand_id if valid
pub async fn validate_api_key(
    pool: &PgPool,
    api_key: &str,
) -> Result<i64, AuthError> {
    // Hash the provided key
    let key_hash = hash_api_key(api_key);
    
    // Look up in database
    let result = sqlx::query_as::<_, (i64, bool)>(
        r#"
        SELECT brand_id, is_active
        FROM brand_api_keys
        WHERE key_hash = $1
        "#
    )
    .bind(&key_hash)
    .fetch_optional(pool)
    .await
    .map_err(|_| AuthError::DatabaseError)?;
    
    match result {
        Some((brand_id, is_active)) => {
            if !is_active {
                return Err(AuthError::KeyDisabled);
            }
            
            // Update last used timestamp
            let _ = sqlx::query(
                "UPDATE brand_api_keys SET last_used_at = NOW() WHERE key_hash = $1"
            )
            .bind(&key_hash)
            .execute(pool)
            .await;
            
            Ok(brand_id)
        }
        None => Err(AuthError::InvalidKey),
    }
}

/// Generates a new API key
pub fn generate_api_key() -> (String, String) {
    let key = format!("vs_live_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    let hash = hash_api_key(&key);
    (key, hash)
}

/// Hashes an API key for storage
pub fn hash_api_key(key: &str) -> String {
    let salt = env::var("API_KEY_HMAC_SALT")
        .expect("API_KEY_HMAC_SALT must be set — refusing to start with default salt");
    let mut mac = HmacSha256::new_from_slice(salt.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(key.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Generates a verification hash for a creator verification response
pub fn generate_verification_hash(
    persona_id: i64,
    profession_id: i64,
    level: i32,
    timestamp: i64,
) -> String {
    let secret = env::var("VERIFICATION_HMAC_SECRET")
        .expect("VERIFICATION_HMAC_SECRET must be set — refusing to start with default secret");
    let data = format!("{}:{}:{}:{}", persona_id, profession_id, level, timestamp);
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(data.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

#[derive(Debug)]
pub enum AuthError {
    InvalidKey,
    KeyDisabled,
    DatabaseError,
    RateLimited,
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::InvalidKey => write!(f, "Invalid API key"),
            AuthError::KeyDisabled => write!(f, "API key is disabled"),
            AuthError::DatabaseError => write!(f, "Database error"),
            AuthError::RateLimited => write!(f, "Rate limit exceeded"),
        }
    }
}
