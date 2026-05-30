//! Instagram OAuth flow for creator authentication
//! Uses Instagram Graph API v18.0 with business account scope

use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstagramConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstagramTokenResponse {
    pub access_token: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstagramUserInfo {
    pub id: String,
    pub username: String,
    pub name: String,
    pub biography: Option<String>,
    pub website: Option<String>,
    pub profile_picture_url: Option<String>,
    pub followers_count: Option<i64>,
    pub follows_count: Option<i64>,
    pub media_count: Option<i64>,
    pub ig_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstagramMediaInsights {
    pub impressions: Option<i64>,
    pub reach: Option<i64>,
    pub engagement: Option<i64>,
}

#[derive(Debug)]
pub enum InstagramOAuthError {
    RequestError(String),
    AuthenticationFailed,
    InvalidToken,
    RateLimited,
}

pub struct InstagramOAuthClient {
    config: InstagramConfig,
    http_client: Client,
}

impl InstagramOAuthClient {
    pub fn new(config: InstagramConfig) -> Self {
        Self {
            config,
            http_client: Client::new(),
        }
    }

    /// Generate Instagram login URL
    pub fn get_auth_url(&self, state: &str) -> String {
        format!(
            "https://api.instagram.com/oauth/authorize?client_id={}&redirect_uri={}&scope=user_profile,user_media&response_type=code&state={}",
            self.config.client_id,
            urlencoding::encode(&self.config.redirect_uri),
            state
        )
    }

    /// Exchange authorization code for access token
    pub async fn exchange_code(&self, code: &str) -> Result<InstagramTokenResponse, InstagramOAuthError> {
        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("client_secret", self.config.client_secret.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", &self.config.redirect_uri),
            ("code", code),
        ];

        let response = self.http_client
            .post("https://graph.instagram.com/v18.0/oauth/access_token")
            .form(&params)
            .send()
            .await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(InstagramOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(InstagramOAuthError::AuthenticationFailed),
        }

        let token_response: InstagramTokenResponse = response.json().await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }

    /// Get creator profile info from Instagram
    pub async fn get_user_info(&self, access_token: &str) -> Result<InstagramUserInfo, InstagramOAuthError> {
        let response = self.http_client
            .get("https://graph.instagram.com/v18.0/me")
            .bearer_auth(access_token)
            .query(&[
                ("fields", "id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,ig_id"),
            ])
            .send()
            .await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(InstagramOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(InstagramOAuthError::InvalidToken),
        }

        let user_info: InstagramUserInfo = response.json().await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        Ok(user_info)
    }

    /// Get media insights (engagement, reach, impressions)
    pub async fn get_media_insights(&self, access_token: &str) -> Result<InstagramMediaInsights, InstagramOAuthError> {
        let response = self.http_client
            .get("https://graph.instagram.com/v18.0/me/media")
            .bearer_auth(access_token)
            .query(&[
                ("fields", "insights.metric(impressions,reach,engagement)"),
                ("limit", "10"),
            ])
            .send()
            .await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(InstagramOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(InstagramOAuthError::InvalidToken),
        }

        // Parse insights and aggregate
        #[derive(Deserialize)]
        struct InsightData {
            data: Vec<InsightItem>,
        }
        #[derive(Deserialize)]
        struct InsightItem {
            insights: Option<InsightMetrics>,
        }
        #[derive(Deserialize)]
        struct InsightMetrics {
            data: Vec<MetricValue>,
        }
        #[derive(Deserialize)]
        struct MetricValue {
            name: String,
            values: Vec<serde_json::Value>,
        }

        let data: InsightData = response.json().await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        // Aggregate metrics across all posts
        let mut total_impressions = 0i64;
        let mut total_reach = 0i64;
        let mut total_engagement = 0i64;

        for item in data.data.iter().flat_map(|i| i.insights.iter()) {
            for metric in &item.data {
                match metric.name.as_str() {
                    "impressions" => {
                        if let Some(serde_json::Value::Number(n)) = metric.values.first() {
                            total_impressions += n.as_i64().unwrap_or(0);
                        }
                    },
                    "reach" => {
                        if let Some(serde_json::Value::Number(n)) = metric.values.first() {
                            total_reach += n.as_i64().unwrap_or(0);
                        }
                    },
                    "engagement" => {
                        if let Some(serde_json::Value::Number(n)) = metric.values.first() {
                            total_engagement += n.as_i64().unwrap_or(0);
                        }
                    },
                    _ => {},
                }
            }
        }

        Ok(InstagramMediaInsights {
            impressions: Some(total_impressions),
            reach: Some(total_reach),
            engagement: Some(total_engagement),
        })
    }

    /// Refresh long-lived access token
    pub async fn refresh_token(&self, access_token: &str) -> Result<InstagramTokenResponse, InstagramOAuthError> {
        let response = self.http_client
            .get("https://graph.instagram.com/v18.0/refresh_access_token")
            .bearer_auth(access_token)
            .query(&[("grant_type", "ig_refresh_token")])
            .send()
            .await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(InstagramOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(InstagramOAuthError::InvalidToken),
        }

        let token_response: InstagramTokenResponse = response.json().await
            .map_err(|e| InstagramOAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }
}
