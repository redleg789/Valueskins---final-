//! Social Platform OAuth Verification
//! 
//! Verify creators actually own their claimed social accounts.

use serde::{Deserialize, Serialize};
use reqwest::Client;

pub struct SocialVerifier {
    client: Client,
    twitter_client_id: String,
    twitter_client_secret: String,
    instagram_client_id: String,
    instagram_client_secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TwitterUserResponse {
    pub data: TwitterUser,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TwitterUser {
    pub id: String,
    pub username: String,
    pub name: String,
    pub public_metrics: TwitterMetrics,
    pub verified: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TwitterMetrics {
    pub followers_count: i64,
    pub following_count: i64,
    pub tweet_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifiedSocialAccount {
    pub platform: String,
    pub platform_id: String,
    pub username: String,
    pub display_name: String,
    pub followers: i64,
    pub verified: bool,
}

impl SocialVerifier {
    pub fn new(
        twitter_client_id: String,
        twitter_client_secret: String,
        instagram_client_id: String,
        instagram_client_secret: String,
    ) -> Self {
        Self {
            client: Client::new(),
            twitter_client_id,
            twitter_client_secret,
            instagram_client_id,
            instagram_client_secret,
        }
    }

    /// Generate OAuth URL for Twitter
    pub fn twitter_auth_url(&self, redirect_uri: &str, state: &str) -> String {
        format!(
            "https://twitter.com/i/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope=tweet.read%20users.read&state={}&code_challenge=challenge&code_challenge_method=plain",
            self.twitter_client_id,
            urlencoding::encode(redirect_uri),
            state
        )
    }

    /// Exchange Twitter OAuth code for access token and get user info
    pub async fn verify_twitter(&self, code: &str, redirect_uri: &str) -> Result<VerifiedSocialAccount, VerifyError> {
        // Exchange code for token
        let token_response: OAuthTokenResponse = self.client
            .post("https://api.twitter.com/2/oauth2/token")
            .basic_auth(&self.twitter_client_id, Some(&self.twitter_client_secret))
            .form(&[
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", redirect_uri),
                ("code_verifier", "challenge"),
            ])
            .send()
            .await?
            .json()
            .await?;

        // Get user info
        let user_response: TwitterUserResponse = self.client
            .get("https://api.twitter.com/2/users/me?user.fields=public_metrics,verified")
            .bearer_auth(&token_response.access_token)
            .send()
            .await?
            .json()
            .await?;

        Ok(VerifiedSocialAccount {
            platform: "twitter".to_string(),
            platform_id: user_response.data.id,
            username: user_response.data.username,
            display_name: user_response.data.name,
            followers: user_response.data.public_metrics.followers_count,
            verified: user_response.data.verified.unwrap_or(false),
        })
    }

    /// Generate OAuth URL for Instagram
    pub fn instagram_auth_url(&self, redirect_uri: &str) -> String {
        format!(
            "https://api.instagram.com/oauth/authorize?client_id={}&redirect_uri={}&scope=user_profile,user_media&response_type=code",
            self.instagram_client_id,
            urlencoding::encode(redirect_uri)
        )
    }

    /// Exchange Instagram OAuth code for access token and get user info
    pub async fn verify_instagram(&self, code: &str, redirect_uri: &str) -> Result<VerifiedSocialAccount, VerifyError> {
        // Exchange code for token
        let token_response: serde_json::Value = self.client
            .post("https://api.instagram.com/oauth/access_token")
            .form(&[
                ("client_id", self.instagram_client_id.as_str()),
                ("client_secret", self.instagram_client_secret.as_str()),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri),
                ("code", code),
            ])
            .send()
            .await?
            .json()
            .await?;

        let access_token = token_response["access_token"].as_str().ok_or(VerifyError::InvalidResponse)?;
        let user_id = token_response["user_id"].as_i64().ok_or(VerifyError::InvalidResponse)?;

        // Get user info
        let user_info: serde_json::Value = self.client
            .get(format!(
                "https://graph.instagram.com/{}?fields=id,username&access_token={}",
                user_id, access_token
            ))
            .send()
            .await?
            .json()
            .await?;

        Ok(VerifiedSocialAccount {
            platform: "instagram".to_string(),
            platform_id: user_id.to_string(),
            username: user_info["username"].as_str().unwrap_or("").to_string(),
            display_name: user_info["username"].as_str().unwrap_or("").to_string(),
            followers: 0, // Need Business account for follower count
            verified: false,
        })
    }
}

#[derive(Debug)]
pub enum VerifyError {
    Http(reqwest::Error),
    InvalidResponse,
}

impl From<reqwest::Error> for VerifyError {
    fn from(e: reqwest::Error) -> Self { VerifyError::Http(e) }
}
