use auth_service::token::TokenManager;
use auth_service::session::SessionError;
use auth_service::error::AuthError;

fn test_manager() -> TokenManager {
    TokenManager::new("test-secret-at-least-32-characters-long!")
}

// ── Token Creation ──

#[test]
fn creates_token_with_valid_creator_role() {
    let tm = test_manager();
    let token = tm.create_token(1, "ig_1", "creator", None).expect("should create token");
    assert!(!token.is_empty());
    let parts: Vec<&str> = token.split('.').collect();
    assert_eq!(parts.len(), 3, "JWT must have 3 parts");
}

#[test]
fn creates_token_with_valid_tier() {
    let tm = test_manager();
    let token = tm.create_token_with_tier(1, "ig_1", "explorer", None, Some("pro".to_string()))
        .expect("should create token with pro tier");
    assert!(!token.is_empty());
}

#[test]
fn rejects_invalid_role() {
    let tm = test_manager();
    let res = tm.create_token(1, "ig_1", "superadmin", None);
    assert!(matches!(res, Err(AuthError::TokenCreationError)));
}

#[test]
fn rejects_invalid_tier() {
    let tm = test_manager();
    let res = tm.create_token_with_tier(1, "ig_1", "creator", None, Some("unlimited".to_string()));
    assert!(matches!(res, Err(AuthError::TokenCreationError)));
}

// ── Token Validation ──

#[test]
fn validates_own_token() {
    let tm = test_manager();
    let token = tm.create_token(42, "ig_42", "host", Some(7)).expect("create");
    let claims = tm.validate_token(&token).expect("should validate");
    assert_eq!(claims.sub, "42");
    assert_eq!(claims.role, "host");
    assert_eq!(claims.persona_id, Some(7));
    assert!(claims.exp > claims.iat);
}

#[test]
fn validates_account_token() {
    let tm = test_manager();
    let token = tm.create_account_token(
        42,
        Some("test@valueskins.local".to_string()),
        true,
        vec!["explorer".to_string(), "host".to_string()],
        vec!["event.browse".to_string(), "event.create".to_string()],
        Some(1),
        Some(7),
    ).expect("create account token");

    let claims = tm.validate_token(&token).expect("should validate");
    assert_eq!(claims.sub, "42");
    assert_eq!(claims.email.unwrap(), "test@valueskins.local");
    assert_eq!(claims.email_verified, Some(true));
    assert_eq!(claims.modules.len(), 2);
    assert_eq!(claims.permissions.len(), 2);
    assert_eq!(claims.tier, Some("free".to_string()));
    assert!(claims.jti.is_some(), "account token must have jti");
}

#[test]
fn rejects_tampered_token() {
    let tm = test_manager();
    let token = tm.create_token(1, "ig_1", "creator", None).expect("create");
    // Tamper with the payload section
    let mut parts: Vec<&str> = token.split('.').collect();
    parts[1] = "eyJzdWIiOiIyIiwicm9sZSI6ImFkbWluIn0"; // {"sub":"2","role":"admin"}
    let tampered = parts.join(".");
    let res = tm.validate_token(&tampered);
    assert!(matches!(res, Err(AuthError::InvalidToken)));
}

#[test]
fn rejects_expired_token() {
    use jsonwebtoken::{encode, Header, Algorithm, EncodingKey};
    use chrono::{Utc, Duration};

    let secret = "test-secret-at-least-32-characters-long!";
    let expired_claims = auth_service::token::Claims {
        sub: "1".to_string(),
        legacy_user_id: Some(1),
        ig_user_id: "ig_1".to_string(),
        role: "creator".to_string(),
        persona_id: None,
        tier: None,
        email: None,
        email_verified: None,
        modules: vec![],
        permissions: vec![],
        age_verification_state: None,
        has_guardian: None,
        is_adult: None,
        trust_score: None,
        trust_tier: None,
        risk_level: None,
        iat: (Utc::now() - Duration::hours(2)).timestamp() as usize,
        exp: (Utc::now() - Duration::hours(1)).timestamp() as usize,
        jti: None,
    };
    let token = encode(&Header::new(Algorithm::HS256), &expired_claims, &EncodingKey::from_secret(secret.as_bytes()))
        .expect("encode");
    let tm = TokenManager::new(secret);
    let res = tm.validate_token(&token);
    assert!(matches!(res, Err(AuthError::InvalidToken)));
}

#[test]
fn validate_round_trip_keeps_all_claims() {
    let tm = test_manager();
    let token = tm.create_account_token(
        99,
        Some("roundtrip@valueskins.local".to_string()),
        true,
        vec!["explorer".to_string(), "valueskin".to_string(), "community".to_string()],
        vec!["event.browse".to_string(), "skin.create".to_string(), "community.join".to_string()],
        Some(5),
        Some(12),
    ).expect("create");
    let claims = tm.validate_token(&token).expect("validate");
    assert_eq!(claims.sub, "99");
    assert_eq!(claims.email.unwrap(), "roundtrip@valueskins.local");
    assert_eq!(claims.email_verified, Some(true));
    assert_eq!(claims.modules, vec!["explorer", "valueskin", "community"]);
    assert_eq!(claims.permissions, vec!["event.browse", "skin.create", "community.join"]);
    assert_eq!(claims.legacy_user_id, Some(5));
    assert_eq!(claims.persona_id, Some(12));
    assert_eq!(claims.tier, Some("free".to_string()));
}

// ── SessionError Display ──

#[test]
fn session_error_invalid_token_display() {
    let err = SessionError::InvalidToken;
    assert_eq!(format!("{}", err), "Invalid refresh token");
}

#[test]
fn session_error_expired_display() {
    let err = SessionError::Expired;
    assert_eq!(format!("{}", err), "Session expired");
}

#[test]
fn session_error_token_theft_display() {
    let err = SessionError::TokenTheft;
    assert_eq!(format!("{}", err), "Token theft detected");
}

#[test]
fn session_error_database_display() {
    let err = SessionError::Database("connection refused".to_string());
    assert_eq!(format!("{}", err), "Database error: connection refused");
}

// ── AuthError Display ──

#[test]
fn auth_error_display_variants() {
    assert_eq!(format!("{}", AuthError::InvalidToken), "Invalid token");
    assert_eq!(format!("{}", AuthError::TokenCreationError), "Token creation failed");
    assert_eq!(format!("{}", AuthError::OAuthFailed("bad code".to_string())), "OAuth failed: bad code");
    assert_eq!(format!("{}", AuthError::SessionExpired), "Session expired");
    assert_eq!(format!("{}", AuthError::AccountLocked), "Account locked");
}
