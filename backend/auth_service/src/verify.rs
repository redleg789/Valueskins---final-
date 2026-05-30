use serde::Deserialize;
use crate::error::AuthError;

/// Response from Meta Graph API /me endpoint
#[derive(Debug, Deserialize)]
pub struct InstagramProfile {
    pub id: String,
    pub username: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub profile_picture_url: Option<String>,
    #[serde(default)]
    pub followers_count: Option<i64>,
    #[serde(default)]
    pub media_count: Option<i64>,
}

/// Verifies an Instagram access token by calling the Meta Graph API.
/// Returns the user's Instagram profile if the token is valid.
///
/// In production, Meta provides the access token after Instagram OAuth.
/// Our backend verifies it's real by calling Graph API /me.
pub async fn verify_instagram_token(access_token: &str) -> Result<InstagramProfile, AuthError> {
    let url = format!(
        "https://graph.instagram.com/me?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token={}",
        access_token
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AuthError::NetworkError(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AuthError::InstagramApiError(format!(
            "Graph API returned {}: {}",
            status, body
        )));
    }

    let profile: InstagramProfile = response
        .json()
        .await
        .map_err(|e| AuthError::InstagramApiError(format!("Failed to parse profile: {}", e)))?;

    Ok(profile)
}
