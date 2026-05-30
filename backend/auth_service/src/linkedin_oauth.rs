//! LinkedIn OAuth flow for creator authentication
//! Uses LinkedIn Sign In v2 with profile and analytics scope

use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedInConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedInTokenResponse {
    pub access_token: String,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
    pub refresh_token_expires_in: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedInUserInfo {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub profile_picture_url: Option<String>,
    pub headline: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedInProfileStats {
    pub follower_count: Option<i64>,
    pub connection_count: Option<i64>,
    pub impressions_count: Option<i64>,
}

#[derive(Debug)]
pub enum LinkedInOAuthError {
    RequestError(String),
    AuthenticationFailed,
    InvalidToken,
    RateLimited,
}

pub struct LinkedInOAuthClient {
    config: LinkedInConfig,
    http_client: Client,
}

impl LinkedInOAuthClient {
    pub fn new(config: LinkedInConfig) -> Self {
        Self {
            config,
            http_client: Client::new(),
        }
    }

    /// Generate LinkedIn login URL
    pub fn get_auth_url(&self, state: &str) -> String {
        format!(
            "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={}&redirect_uri={}&scope=openid%20profile%20email%20w_member_social&state={}",
            self.config.client_id,
            urlencoding::encode(&self.config.redirect_uri),
            state
        )
    }

    /// Exchange authorization code for access token
    pub async fn exchange_code(&self, code: &str) -> Result<LinkedInTokenResponse, LinkedInOAuthError> {
        let params = [
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", &self.config.redirect_uri),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
        ];

        let response = self.http_client
            .post("https://www.linkedin.com/oauth/v2/accessToken")
            .form(&params)
            .send()
            .await
            .map_err(|e| LinkedInOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(LinkedInOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(LinkedInOAuthError::AuthenticationFailed),
        }

        let token_response: LinkedInTokenResponse = response.json().await
            .map_err(|e| LinkedInOAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }

    /// Get user profile info
    pub async fn get_user_info(&self, access_token: &str) -> Result<LinkedInUserInfo, LinkedInOAuthError> {
        let response = self.http_client
            .get("https://api.linkedin.com/v2/userinfo")
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| LinkedInOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(LinkedInOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(LinkedInOAuthError::InvalidToken),
        }

        #[derive(Deserialize)]
        struct UserResponse {
            sub: String,
            given_name: String,
            family_name: String,
            email: Option<String>,
            picture: Option<String>,
            headline: Option<String>,
        }

        let user: UserResponse = response.json().await
            .map_err(|e| LinkedInOAuthError::RequestError(e.to_string()))?;

        Ok(LinkedInUserInfo {
            id: user.sub,
            first_name: user.given_name,
            last_name: user.family_name,
            email: user.email,
            profile_picture_url: user.picture,
            headline: user.headline,
        })
    }

    /// Get profile analytics (followers, connections, impressions)
    pub async fn get_profile_stats(&self, access_token: &str) -> Result<LinkedInProfileStats, LinkedInOAuthError> {
        let response = self.http_client
            .get("https://api.linkedin.com/v2/me")
            .bearer_auth(access_token)
            .query(&[
                ("projection", "(id,localizedFirstName,localizedLastName,profilePicture(displayImage))"),
            ])
            .send()
            .await
            .map_err(|e| LinkedInOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(LinkedInOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(LinkedInOAuthError::InvalidToken),
        }

        // LinkedIn API returns follower/connection stats in separate endpoint
        // For MVP, return placeholder; production fetches from /v2/networkSize
        Ok(LinkedInProfileStats {
            follower_count: None,
            connection_count: None,
            impressions_count: None,
        })
    }

    /// Refresh access token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<LinkedInTokenResponse, LinkedInOAuthError> {
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
        ];

        let response = self.http_client
            .post("https://www.linkedin.com/oauth/v2/accessToken")
            .form(&params)
            .send()
            .await
            .map_err(|e| LinkedInOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(LinkedInOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(LinkedInOAuthError::AuthenticationFailed),
        }

        let token_response: LinkedInTokenResponse = response.json().await
            .map_err(|e| LinkedInOAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }
}
