use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use crate::error::AuthError;

const VALID_ROLES: [&str; 6] = ["creator", "brand", "moderator", "admin", "explorer", "host"];
const VALID_TIERS: [&str; 4] = ["free", "basic", "pro", "enterprise"];
const VALID_AGE_STATES: [&str; 16] = [
    "UNVERIFIED", "PENDING_SELF_DECLARATION", "SELF_DECLARED_ADULT",
    "PENDING_DOCUMENT_UPLOAD", "PENDING_DOCUMENT_REVIEW", "DOCUMENT_REJECTED",
    "MINOR_PENDING_GUARDIAN", "MINOR_GUARDIAN_PENDING_APPROVAL",
    "MINOR_GUARDIAN_APPROVED", "MINOR_ACTIVE", "ADULT_ACTIVE",
    "AGE_ESCALATED", "AGE_LOCKED", "AGE_UNDER_REVIEW",
    "AGE_TRANSFERRING_TO_ADULT", "AGE_EXPIRED",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Account ID (primary key in accounts table) — used by unified system
    pub sub: String,
    /// Legacy user ID (from users table) for backward compatibility
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_user_id: Option<i64>,
    /// Instagram user ID (from Meta Graph API)
    #[serde(default)]
    pub ig_user_id: String,
    /// User role: "creator", "brand", "explorer", "host", "moderator", "admin"
    pub role: String,
    /// Persona ID if the user has one
    pub persona_id: Option<i64>,
    /// API rate limit tier: "free" | "basic" | "pro" | "enterprise"
    pub tier: Option<String>,

    // ── Unified Account Fields ──
    /// Account email
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Whether email is verified
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email_verified: Option<bool>,
    /// Active module codes (e.g. ["explorer", "host"])
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub modules: Vec<String>,
    /// Granted permission codes (resolved from active modules)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub permissions: Vec<String>,

    // ── Trust & Verification Claims ──
    pub age_verification_state: Option<String>,
    pub has_guardian: Option<bool>,
    pub is_adult: Option<bool>,
    pub trust_score: Option<i32>,
    pub trust_tier: Option<String>,
    pub risk_level: Option<String>,

    /// Token expiration (Unix timestamp)
    pub exp: usize,
    /// Token issued at (Unix timestamp)
    pub iat: usize,
    /// Token unique ID (for revocation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jti: Option<String>,
}

pub struct TokenManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl TokenManager {
    pub fn new(secret: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
        }
    }

    pub fn create_token(
        &self,
        user_id: i64,
        ig_user_id: &str,
        role: &str,
        persona_id: Option<i64>,
    ) -> Result<String, AuthError> {
        self.create_token_with_tier(user_id, ig_user_id, role, persona_id, None)
    }

    pub fn create_token_with_tier(
        &self,
        user_id: i64,
        ig_user_id: &str,
        role: &str,
        persona_id: Option<i64>,
        tier: Option<String>,
    ) -> Result<String, AuthError> {
        // Reject invalid roles at token creation
        if !VALID_ROLES.contains(&role) {
            return Err(AuthError::TokenCreationError);
        }
        if let Some(ref t) = tier {
            if !VALID_TIERS.contains(&t.as_str()) {
                return Err(AuthError::TokenCreationError);
            }
        }

        let now = Utc::now();
        let expiration = now
            .checked_add_signed(Duration::try_hours(24).expect("valid duration"))
            .expect("valid timestamp")
            .timestamp();

        let claims = Claims {
            sub: user_id.to_string(),
            legacy_user_id: Some(user_id),
            ig_user_id: ig_user_id.to_owned(),
            role: role.to_owned(),
            persona_id,
            tier,
            email: None,
            email_verified: None,
            modules: Vec::new(),
            permissions: Vec::new(),
            age_verification_state: None,
            has_guardian: None,
            is_adult: None,
            trust_score: None,
            trust_tier: None,
            risk_level: None,
            iat: now.timestamp() as usize,
            exp: expiration as usize,
            jti: None,
        };

        let header = Header::new(Algorithm::HS256);
        encode(&header, &claims, &self.encoding_key)
            .map_err(|_| AuthError::TokenCreationError)
    }

    /// Create a unified account token with modules and permissions
    pub fn create_account_token(
        &self,
        account_id: i64,
        email: Option<String>,
        email_verified: bool,
        modules: Vec<String>,
        permissions: Vec<String>,
        legacy_user_id: Option<i64>,
        persona_id: Option<i64>,
    ) -> Result<String, AuthError> {
        let now = Utc::now();
        let expiration = now
            .checked_add_signed(Duration::try_minutes(15).expect("valid duration"))
            .expect("valid timestamp")
            .timestamp();

        let jti = uuid::Uuid::new_v4().to_string();

        let claims = Claims {
            sub: account_id.to_string(),
            legacy_user_id,
            ig_user_id: String::new(),
            role: "explorer".to_string(),
            persona_id,
            tier: Some("free".to_string()),
            email,
            email_verified: Some(email_verified),
            modules,
            permissions,
            age_verification_state: None,
            has_guardian: None,
            is_adult: None,
            trust_score: None,
            trust_tier: None,
            risk_level: None,
            iat: now.timestamp() as usize,
            exp: expiration as usize,
            jti: Some(jti),
        };

        let header = Header::new(Algorithm::HS256);
        encode(&header, &claims, &self.encoding_key)
            .map_err(|_| AuthError::TokenCreationError)
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, AuthError> {
        // Pin algorithm to HS256 to prevent algorithm confusion attacks.
        // Validation::default() accepts any algorithm — an attacker could
        // forge a token using "none" or switch to RS256 with the HMAC secret
        // as a public key, bypassing signature verification entirely.
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        validation.validate_nbf = false;
        validation.leeway = 30; // 30-second clock skew tolerance for distributed deploys

        let token_data = decode::<Claims>(
            token,
            &self.decoding_key,
            &validation,
        ).map_err(|_| AuthError::InvalidToken)?;

        // Post-decode validation: reject tokens with invalid role/tier claims
        // even if signature is valid (defense-in-depth against DB corruption)
        if !VALID_ROLES.contains(&token_data.claims.role.as_str()) {
            return Err(AuthError::InvalidToken);
        }
        if let Some(ref t) = token_data.claims.tier {
            if !VALID_TIERS.contains(&t.as_str()) {
                return Err(AuthError::InvalidToken);
            }
        }

        Ok(token_data.claims)
    }
}

pub fn create_token(user_id: i64, role: &str) -> Result<String, AuthError> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| AuthError::TokenCreationError)?;
    let manager = TokenManager::new(&secret);
    manager.create_token(user_id, "", role, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration as ChronoDuration, Utc};
    use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};

    fn test_manager() -> TokenManager {
        TokenManager::new("test-secret-at-least-32-characters-long")
    }

    #[test]
    fn rejects_invalid_role_on_create() {
        let tm = test_manager();
        let res = tm.create_token(1, "ig_1", "admin", None);
        assert!(matches!(res, Err(AuthError::TokenCreationError)));
    }

    #[test]
    fn rejects_invalid_tier_on_create() {
        let tm = test_manager();
        let res = tm.create_token_with_tier(1, "ig_1", "creator", None, Some("godmode".to_string()));
        assert!(matches!(res, Err(AuthError::TokenCreationError)));
    }

    #[test]
    fn rejects_tampered_role_even_with_valid_signature() {
        let secret = "test-secret-at-least-32-characters-long";
        let now = Utc::now().timestamp() as usize;
        let claims = Claims {
            sub: "42".to_string(),
            legacy_user_id: Some(42),
            ig_user_id: "ig_42".to_string(),
            role: "admin".to_string(),
            persona_id: Some(7),
            tier: Some("pro".to_string()),
            email: None,
            email_verified: None,
            modules: Vec::new(),
            permissions: Vec::new(),
            age_verification_state: None,
            has_guardian: None,
            is_adult: None,
            trust_score: None,
            trust_tier: None,
            risk_level: None,
            iat: now,
            exp: (Utc::now() + ChronoDuration::hours(1)).timestamp() as usize,
            jti: None,
        };
        let token = encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret.as_bytes()))
            .expect("token creation must succeed");
        let tm = TokenManager::new(secret);
        let res = tm.validate_token(&token);
        assert!(matches!(res, Err(AuthError::InvalidToken)));
    }

    #[test]
    fn rejects_tampered_tier_even_with_valid_signature() {
        let secret = "test-secret-at-least-32-characters-long";
        let now = Utc::now().timestamp() as usize;
        let claims = Claims {
            sub: "42".to_string(),
            legacy_user_id: Some(42),
            ig_user_id: "ig_42".to_string(),
            role: "creator".to_string(),
            persona_id: None,
            tier: Some("ultra".to_string()),
            email: None,
            email_verified: None,
            modules: Vec::new(),
            permissions: Vec::new(),
            age_verification_state: None,
            has_guardian: None,
            is_adult: None,
            trust_score: None,
            trust_tier: None,
            risk_level: None,
            iat: now,
            exp: (Utc::now() + ChronoDuration::hours(1)).timestamp() as usize,
            jti: None,
        };
        let token = encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret.as_bytes()))
            .expect("token creation must succeed");
        let tm = TokenManager::new(secret);
        let res = tm.validate_token(&token);
        assert!(matches!(res, Err(AuthError::InvalidToken)));
    }
}
