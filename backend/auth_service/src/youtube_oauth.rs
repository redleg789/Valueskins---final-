//! YouTube OAuth flow for creator authentication
//! Uses YouTube Data API v3 with channel management scope

use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YouTubeConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YouTubeTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub token_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YouTubeUserInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub thumbnail_url: Option<String>,
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YouTubeChannelStats {
    pub subscriber_count: Option<String>,
    pub view_count: Option<String>,
    pub video_count: Option<String>,
}

#[derive(Debug)]
pub enum YouTubeOAuthError {
    RequestError(String),
    AuthenticationFailed,
    InvalidToken,
    RateLimited,
}

pub struct YouTubeOAuthClient {
    config: YouTubeConfig,
    http_client: Client,
}

impl YouTubeOAuthClient {
    pub fn new(config: YouTubeConfig) -> Self {
        Self {
            config,
            http_client: Client::new(),
        }
    }

    /// Generate YouTube login URL
    pub fn get_auth_url(&self, state: &str) -> String {
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly%20https://www.googleapis.com/auth/yt-analytics.readonly&state={}&access_type=offline",
            self.config.client_id,
            urlencoding::encode(&self.config.redirect_uri),
            state
        )
    }

    /// Exchange authorization code for access token
    pub async fn exchange_code(&self, code: &str) -> Result<YouTubeTokenResponse, YouTubeOAuthError> {
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
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(YouTubeOAuthError::AuthenticationFailed);
        }

        let token_response: YouTubeTokenResponse = response.json().await
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }

    /// Get creator channel info
    pub async fn get_channel_info(&self, access_token: &str) -> Result<YouTubeUserInfo, YouTubeOAuthError> {
        let response = self.http_client
            .get("https://www.googleapis.com/youtube/v3/channels")
            .bearer_auth(access_token)
            .query(&[
                ("part", "snippet"),
                ("mine", "true"),
            ])
            .send()
            .await
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(YouTubeOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(YouTubeOAuthError::InvalidToken),
        }

        #[derive(Deserialize)]
        struct ChannelsResponse {
            items: Vec<ChannelItem>,
        }
        #[derive(Deserialize)]
        struct ChannelItem {
            id: String,
            snippet: ChannelSnippet,
        }
        #[derive(Deserialize)]
        struct ChannelSnippet {
            title: String,
            description: Option<String>,
            thumbnails: Option<Thumbnails>,
            published_at: Option<String>,
        }
        #[derive(Deserialize)]
        struct Thumbnails {
            default: Option<Thumbnail>,
        }
        #[derive(Deserialize)]
        struct Thumbnail {
            url: String,
        }

        let channels: ChannelsResponse = response.json().await
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        let channel = channels.items.into_iter().next()
            .ok_or(YouTubeOAuthError::InvalidToken)?;

        Ok(YouTubeUserInfo {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            thumbnail_url: channel.snippet.thumbnails
                .and_then(|t| t.default)
                .map(|t| t.url),
            published_at: channel.snippet.published_at,
        })
    }

    /// Get channel statistics (subscribers, views, videos)
    pub async fn get_channel_stats(&self, access_token: &str) -> Result<YouTubeChannelStats, YouTubeOAuthError> {
        let response = self.http_client
            .get("https://www.googleapis.com/youtube/v3/channels")
            .bearer_auth(access_token)
            .query(&[
                ("part", "statistics"),
                ("mine", "true"),
            ])
            .send()
            .await
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        match response.status().as_u16() {
            429 => return Err(YouTubeOAuthError::RateLimited),
            200..=299 => {},
            _ => return Err(YouTubeOAuthError::InvalidToken),
        }

        #[derive(Deserialize)]
        struct StatsResponse {
            items: Vec<StatsItem>,
        }
        #[derive(Deserialize)]
        struct StatsItem {
            statistics: Statistics,
        }
        #[derive(Deserialize)]
        struct Statistics {
            #[serde(rename = "subscriberCount")]
            subscriber_count: Option<String>,
            #[serde(rename = "viewCount")]
            view_count: Option<String>,
            #[serde(rename = "videoCount")]
            video_count: Option<String>,
        }

        let stats: StatsResponse = response.json().await
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        let stats_item = stats.items.into_iter().next()
            .ok_or(YouTubeOAuthError::InvalidToken)?;

        Ok(YouTubeChannelStats {
            subscriber_count: stats_item.statistics.subscriber_count,
            view_count: stats_item.statistics.view_count,
            video_count: stats_item.statistics.video_count,
        })
    }

    /// Refresh access token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<YouTubeTokenResponse, YouTubeOAuthError> {
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
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(YouTubeOAuthError::AuthenticationFailed);
        }

        let token_response: YouTubeTokenResponse = response.json().await
            .map_err(|e| YouTubeOAuthError::RequestError(e.to_string()))?;

        Ok(token_response)
    }
}
