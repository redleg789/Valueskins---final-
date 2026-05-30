//! Google OAuth flow for authentication
//! Standard OpenID Connect implementation

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
    pub id_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleUserInfo {
    pub sub: String,              // Unique identifier
    pub email: String,
    pub email_verified: bool,
    pub name: String,
    pub picture: Option<String>,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
}

pub struct GoogleOAuthClient {
    config: GoogleConfig,
    http_client: reqwest::Client,
}

impl GoogleOAuthClient {
    pub fn new(config: GoogleConfig) -> Self {
        Self {
            config,
            http_client: reqwest::Client::new(),
        }
    }

    /// Generate Google login URL
    pub fn get_auth_url(&self, state: &str) -> String {
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&state={}",
            self.config.client_id,
            urlencoding::encode(&self.config.redirect_uri),
            state
        )
    }

    /// Exchange authorization code for tokens
    pub async fn exchange_code(&self, code: &str) -> Result<GoogleTokenResponse, OAuthError> {
        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", self.config.client_secret.as_str()),
            ("code", code),
            ("redirect_uri", &self.config.redirect_uri),
            ("grant_type", "authorization_code"),
        ];

        let response = self.http_client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(OAuthError::AuthenticationFailed);
        }

        let token_response: GoogleTokenResponse = response.json().await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }

    /// Verify and decode ID token
    pub async fn verify_id_token(&self, id_token: &str) -> Result<GoogleUserInfo, OAuthError> {
        let response = self.http_client
            .get("https://oauth2.googleapis.com/tokeninfo")
            .query(&[("id_token", id_token)])
            .send()
            .await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(OAuthError::InvalidToken);
        }

        let user_info: GoogleUserInfo = response
            .json()
            .await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        if user_info.sub.is_empty() || user_info.email.is_empty() || !user_info.email_verified {
            return Err(OAuthError::InvalidToken);
        }

        Ok(user_info)
    }

    /// Get user info from access token
    pub async fn get_user_info(&self, access_token: &str) -> Result<GoogleUserInfo, OAuthError> {
        let response = self.http_client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(OAuthError::InvalidToken);
        }

        let user_info: GoogleUserInfo = response.json().await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        Ok(user_info)
    }

    /// Refresh access token using refresh token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<GoogleTokenResponse, OAuthError> {
        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", self.config.client_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ];

        let response = self.http_client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(OAuthError::AuthenticationFailed);
        }

        let token_response: GoogleTokenResponse = response.json().await
            .map_err(|e| OAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
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
