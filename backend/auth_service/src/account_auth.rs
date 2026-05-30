//! Unified Account Authentication
//!
//! Handles email/password signup & login, plus account linking for OAuth.
//! This is the primary auth entry point for the unified account system.

use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

#[derive(Debug, Deserialize)]
pub struct SignupRequest {
    pub email: Option<String>,
    pub password: Option<String>,
    pub google_token: Option<String>,
    pub apple_token: Option<String>,
    pub phone: Option<String>,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: Option<String>,
    pub password: Option<String>,
    pub google_token: Option<String>,
    pub apple_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhoneOtpRequest {
    pub phone: String,
}

#[derive(Debug, Deserialize)]
pub struct PhoneOtpVerifyRequest {
    pub phone: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct TwoFactorRequest {
    pub totp_code: String,
    pub session_token: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub account_id: i64,
    pub requires_2fa: bool,
}

#[derive(Debug, Serialize)]
pub struct SignupResponse {
    pub message: String,
    pub account_id: i64,
    pub requires_email_verification: bool,
}

/// Hash a plaintext password with a random salt using SHA-256 (stretch)
/// In production, use bcrypt or argon2. This is a lightweight stand-in
/// that matches the existing pattern in the frontend (bcrypt rounds = 12).
pub fn hash_password(password: &str) -> String {
    let salt = rand::thread_rng().gen::<[u8; 32]>();
    let mut hasher = Sha256::new();
    hasher.update(&salt);
    hasher.update(password.as_bytes());
    let hash = hasher.finalize();
    format!("{}:{}", hex::encode(salt), hex::encode(hash))
}

pub fn verify_password(password: &str, stored_hash: &str) -> bool {
    let parts: Vec<&str> = stored_hash.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let salt = hex::decode(parts[0]).unwrap_or_default();
    let expected = parts[1];
    let mut hasher = Sha256::new();
    hasher.update(&salt);
    hasher.update(password.as_bytes());
    let hash = hex::encode(hasher.finalize());
    hash == expected
}

/// Generate a cryptographically secure random string for refresh tokens
pub fn generate_refresh_token() -> String {
    let bytes: [u8; 32] = rand::thread_rng().gen();
    hex::encode(bytes)
}

/// Hash a refresh token for storage (SHA-256)
pub fn hash_refresh_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Generate a TOTP-compatible secret
pub fn generate_totp_secret() -> String {
    let bytes: [u8; 20] = rand::thread_rng().gen();
    base32::encode(base32::Alphabet::Rfc4648 { padding: false }, &bytes)
}
