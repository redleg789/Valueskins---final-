//! Apple Sign In integration
//!
//! Implements Apple's OAuth 2.0 + OpenID Connect flow.
//! Uses the `sub` claim as the stable Apple user identifier.

use serde::{Deserialize, Serialize};
use tracing;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleConfig {
    pub client_id: String,
    pub team_id: String,
    pub key_id: String,
    pub private_key: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub id_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleIdTokenClaims {
    pub sub: String,
    pub email: Option<String>,
    pub email_verified: Option<bool>,
    pub is_private_email: Option<bool>,
    pub aud: String,
    pub exp: usize,
    pub iat: usize,
}

pub struct AppleOAuthClient {
    config: AppleConfig,
    http_client: reqwest::Client,
}

impl AppleOAuthClient {
    pub fn new(config: AppleConfig) -> Self {
        Self {
            config,
            http_client: reqwest::Client::new(),
        }
    }

    /// Generate the Apple Sign In URL
    pub fn get_auth_url(&self, state: &str) -> String {
        format!(
            "https://appleid.apple.com/auth/authorize?client_id={}&redirect_uri={}&response_type=code%20id_token&scope=name%20email&response_mode=form_post&state={}",
            self.config.client_id,
            urlencoding::encode(&self.config.redirect_uri),
            state
        )
    }

    /// Exchange authorization code for tokens
    pub async fn exchange_code(&self, code: &str) -> Result<AppleTokenResponse, OAuthError> {
        // Note: Apple requires a JWT client_secret generated from your private key
        // For simplicity, we use client_secret directly if configured
        let client_secret = self.generate_client_secret();

        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", &client_secret),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", &self.config.redirect_uri),
        ];

        let response = self.http_client
            .post("https://appleid.apple.com/auth/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(OAuthError::AuthenticationFailed);
        }

        let token_response: AppleTokenResponse = response.json().await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }

    /// Verify and decode the ID token to extract user info
    /// In production, verify the JWT signature against Apple's public keys
    pub fn decode_id_token(&self, id_token: &str) -> Result<AppleIdTokenClaims, OAuthError> {
        let parts: Vec<&str> = id_token.split('.').collect();
        if parts.len() != 3 {
            return Err(OAuthError::InvalidToken);
        }

        // Decode the payload (base64)
        use base64::Engine as _;
        let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(parts[1])
            .map_err(|_| OAuthError::InvalidToken)?;

        let claims: AppleIdTokenClaims = serde_json::from_slice(&payload)
            .map_err(|_| OAuthError::InvalidToken)?;

        // Verify expiry
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize;

        if claims.exp <= now {
            return Err(OAuthError::InvalidToken);
        }

        Ok(claims)
    }

    fn generate_client_secret(&self) -> String {
        // In production: generate a JWT signed with your Apple private key
        // containing: iss=team_id, iat=now, exp=now+6months, aud=https://appleid.apple.com/sub=client_id
        // The private key is a .p8 file downloaded from Apple Developer Portal
        std::env::var("APPLE_CLIENT_SECRET")
            .unwrap_or_else(|_| {
                tracing::warn!("APPLE_CLIENT_SECRET not set, using placeholder");
                "placeholder".to_string()
            })
    }
}

#[derive(Debug)]
pub enum OAuthError {
    RequestError(String),
    AuthenticationFailed,
    InvalidToken,
}

impl std::fmt::Display for OAuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OAuthError::RequestError(e) => write!(f, "Request error: {}", e),
            OAuthError::AuthenticationFailed => write!(f, "Authentication failed"),
            OAuthError::InvalidToken => write!(f, "Invalid token"),
        }
    }
}

impl std::error::Error for OAuthError {}
