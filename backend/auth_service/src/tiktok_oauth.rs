//! TikTok OAuth flow for creator authentication
//! Uses TikTok API with creator monetization scope

use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TikTokConfig {
    pub client_key: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TikTokTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub open_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TikTokUserInfo {
    pub open_id: String,
    pub union_id: Option<String>,
    pub display_name: String,
    pub avatar_large_url: Option<String>,
    pub bio_description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TikTokUserStats {
    pub follower_count: Option<i64>,
    pub following_count: Option<i64>,
    pub video_count: Option<i64>,
    pub heart_count: Option<i64>,
}

#[derive(Debug)]
pub enum TikTokOAuthError {
    RequestError(String),
    AuthenticationFailed,
    InvalidToken,
    RateLimited,
}

pub struct TikTokOAuthClient {
    config: TikTokConfig,
    http_client: Client,
}

impl TikTokOAuthClient {
    pub fn new(config: TikTokConfig) -> Self {
        Self {
            config,
            http_client: Client::new(),
        }
    }

    /// Generate TikTok login URL
    pub fn get_auth_url(&self, state: &str) -> String {
        format!(
            "https://www.tiktok.com/v3/oauth/authorize/?client_key={}&scope=user.info.basic,user.read&redirect_uri={}&response_type=code&state={}",
            self.config.client_key,
            urlencoding::encode(&self.config.redirect_uri),
            state
        )
    }

    /// Exchange authorization code for access token
    pub async fn exchange_code(&self, code: &str) -> Result<TikTokTokenResponse, TikTokOAuthError> {
        let body = serde_json::json!({
            "client_key": self.config.client_key,
            "client_secret": self.config.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": self.config.redirect_uri,
        });

        let response = self.http_client
            .post("https://open.tiktokapis.com/v2/oauth/token/")
            .json(&body)
            .send()
            .await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(TikTokOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(TikTokOAuthError::AuthenticationFailed),
        }

        #[derive(Deserialize)]
        struct TokenWrapper {
            data: TikTokTokenResponse,
        }

        let wrapper: TokenWrapper = response.json().await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        Ok(wrapper.data)
    }

    /// Get creator user info
    pub async fn get_user_info(&self, access_token: &str, open_id: &str) -> Result<TikTokUserInfo, TikTokOAuthError> {
        let response = self.http_client
            .get("https://open.tiktokapis.com/v2/user/info/")
            .bearer_auth(access_token)
            .query(&[
                ("fields", "open_id,union_id,display_name,avatar_large_url,bio_description"),
            ])
            .send()
            .await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(TikTokOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(TikTokOAuthError::InvalidToken),
        }

        #[derive(Deserialize)]
        struct UserWrapper {
            data: UserData,
        }
        #[derive(Deserialize)]
        struct UserData {
            user: TikTokUserInfo,
        }

        let wrapper: UserWrapper = response.json().await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        Ok(wrapper.data.user)
    }

    /// Get creator statistics
    pub async fn get_user_stats(&self, access_token: &str) -> Result<TikTokUserStats, TikTokOAuthError> {
        let response = self.http_client
            .get("https://open.tiktokapis.com/v2/user/stat/")
            .bearer_auth(access_token)
            .query(&[
                ("fields", "follower_count,following_count,video_count,heart_count"),
            ])
            .send()
            .await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(TikTokOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(TikTokOAuthError::InvalidToken),
        }

        #[derive(Deserialize)]
        struct StatsWrapper {
            data: UserStats,
        }
        #[derive(Deserialize)]
        struct UserStats {
            follower_count: Option<i64>,
            following_count: Option<i64>,
            video_count: Option<i64>,
            heart_count: Option<i64>,
        }

        let wrapper: StatsWrapper = response.json().await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        Ok(TikTokUserStats {
            follower_count: wrapper.data.follower_count,
            following_count: wrapper.data.following_count,
            video_count: wrapper.data.video_count,
            heart_count: wrapper.data.heart_count,
        })
    }

    /// Refresh access token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<TikTokTokenResponse, TikTokOAuthError> {
        let body = serde_json::json!({
            "client_key": self.config.client_key,
            "client_secret": self.config.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        });

        let response = self.http_client
            .post("https://open.tiktokapis.com/v2/oauth/token/")
            .json(&body)
            .send()
            .await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(TikTokOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(TikTokOAuthError::AuthenticationFailed),
        }

        #[derive(Deserialize)]
        struct TokenWrapper {
            data: TikTokTokenResponse,
        }

        let wrapper: TokenWrapper = response.json().await
            .map_err(|e| TikTokOAuthError::RequestError(e.to_string()))?;

        Ok(wrapper.data)
    }
}
