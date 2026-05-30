//! Unified OAuth handler supporting multiple platforms
//! Routes OAuth flows for: Google, Instagram, YouTube, TikTok, LinkedIn

use actix_web::{web, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const OAUTH_STATE_TTL: Duration = Duration::from_secs(600);

fn oauth_state_store() -> &'static Mutex<HashMap<String, Instant>> {
    static OAUTH_STATES: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    OAUTH_STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn store_oauth_state(state: &str) {
    if let Ok(mut states) = oauth_state_store().lock() {
        let now = Instant::now();
        states.retain(|_, created_at| now.duration_since(*created_at) < OAUTH_STATE_TTL);
        states.insert(state.to_string(), now);
    }
}

fn consume_oauth_state(state: &str) -> bool {
    if let Ok(mut states) = oauth_state_store().lock() {
        let now = Instant::now();
        states.retain(|_, created_at| now.duration_since(*created_at) < OAUTH_STATE_TTL);
        if let Some(created_at) = states.remove(state) {
            return now.duration_since(created_at) < OAUTH_STATE_TTL;
        }
    }
    false
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthCallbackRequest {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthLoginResponse {
    pub jwt_token: String,
    pub user_id: i64,
    pub persona_id: i64,
    pub platform: String,
    pub username: Option<String>,
    pub profile_picture: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthStartRequest {
    pub platform: String, // "google", "instagram", "youtube", "tiktok", "linkedin"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthUrlResponse {
    pub auth_url: String,
    pub state: String,
}

/// POST /auth/oauth/start — Generate OAuth login URL for platform
pub async fn start_oauth(
    req: web::Json<OAuthStartRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let platform = req.platform.to_lowercase();
    let state = Uuid::new_v4().to_string();
    store_oauth_state(&state);

    let auth_url = match platform.as_str() {
        "google" => {
            // Get config from env
            let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default();
            let redirect_uri = format!("{}/auth/oauth/callback/google",
                std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

            format!(
                "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&state={}",
                client_id,
                urlencoding::encode(&redirect_uri),
                state
            )
        },
        "instagram" => {
            let client_id = std::env::var("INSTAGRAM_CLIENT_ID").unwrap_or_default();
            let redirect_uri = format!("{}/auth/oauth/callback/instagram",
                std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

            format!(
                "https://api.instagram.com/oauth/authorize?client_id={}&redirect_uri={}&scope=user_profile,user_media&response_type=code&state={}",
                client_id,
                urlencoding::encode(&redirect_uri),
                state
            )
        },
        "youtube" => {
            let client_id = std::env::var("YOUTUBE_CLIENT_ID").unwrap_or_default();
            let redirect_uri = format!("{}/auth/oauth/callback/youtube",
                std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

            format!(
                "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly%20https://www.googleapis.com/auth/yt-analytics.readonly&state={}&access_type=offline",
                client_id,
                urlencoding::encode(&redirect_uri),
                state
            )
        },
        "tiktok" => {
            let client_key = std::env::var("TIKTOK_CLIENT_KEY").unwrap_or_default();
            let redirect_uri = format!("{}/auth/oauth/callback/tiktok",
                std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

            format!(
                "https://www.tiktok.com/v3/oauth/authorize/?client_key={}&scope=user.info.basic,user.read&redirect_uri={}&response_type=code&state={}",
                client_key,
                urlencoding::encode(&redirect_uri),
                state
            )
        },
        "linkedin" => {
            let client_id = std::env::var("LINKEDIN_CLIENT_ID").unwrap_or_default();
            let redirect_uri = format!("{}/auth/oauth/callback/linkedin",
                std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

            format!(
                "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={}&redirect_uri={}&scope=openid%20profile%20email&state={}",
                client_id,
                urlencoding::encode(&redirect_uri),
                state
            )
        },
        _ => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "unsupported_platform",
            "message": format!("Platform '{}' not supported", platform)
        })),
    };

    HttpResponse::Ok().json(OAuthUrlResponse {
        auth_url,
        state,
    })
}

/// GET /auth/oauth/callback/:platform — Handle OAuth callback for platform
pub async fn oauth_callback(
    platform: web::Path<String>,
    query: web::Query<OAuthCallbackRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let platform = platform.to_lowercase();
    let code = &query.code;
    if !consume_oauth_state(&query.state) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_oauth_state"
        }));
    }

    match platform.as_str() {
        "google" => handle_google_callback(code, &pool).await,
        "instagram" => handle_instagram_callback(code, &pool).await,
        "youtube" => handle_youtube_callback(code, &pool).await,
        "tiktok" => handle_tiktok_callback(code, &pool).await,
        "linkedin" => handle_linkedin_callback(code, &pool).await,
        _ => HttpResponse::BadRequest().json(serde_json::json!({
            "error": "unsupported_platform"
        })),
    }
}

/// Handle Google OAuth callback
async fn handle_google_callback(code: &str, pool: &PgPool) -> HttpResponse {
    let client_id = match std::env::var("GOOGLE_CLIENT_ID") {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "google_not_configured"
        })),
    };

    let client_secret = match std::env::var("GOOGLE_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "google_not_configured"
        })),
    };

    let redirect_uri = format!("{}/auth/oauth/callback/google",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

    // Exchange code for token
    let google_client = auth_service::google_oauth::GoogleOAuthClient::new(
        auth_service::google_oauth::GoogleConfig {
            client_id,
            client_secret,
            redirect_uri,
        }
    );

    let token_response = match google_client.exchange_code(code).await {
        Ok(token) => token,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_authorization_code"
        })),
    };

    // Get user info from Google
    let user_info = match google_client.get_user_info(&token_response.access_token).await {
        Ok(info) => info,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "failed_to_fetch_user_info"
        })),
    };

    // Upsert user into database
    let user_id: i64 = match sqlx::query_scalar(
        r#"
        INSERT INTO users (email, provider, provider_id, name, profile_picture, created_at, updated_at)
        VALUES ($1, 'google', $2, $3, $4, NOW(), NOW())
        ON CONFLICT (provider, provider_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(&user_info.email)
    .bind(&user_info.sub)
    .bind(&user_info.name)
    .bind(&user_info.picture)
    .fetch_one(pool)
    .await {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error"
        })),
    };

    // Create JWT token
    let jwt_token = match auth_service::token::create_token(user_id, "brand") {
        Ok(token) => token,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "token_generation_failed"
        })),
    };

    HttpResponse::Ok().json(OAuthLoginResponse {
        jwt_token,
        user_id,
        persona_id: 0, // Will be created on first profile setup
        platform: "google".to_string(),
        username: Some(user_info.email.clone()),
        profile_picture: user_info.picture,
    })
}

/// Handle Instagram OAuth callback
async fn handle_instagram_callback(code: &str, pool: &PgPool) -> HttpResponse {
    let client_id = match std::env::var("INSTAGRAM_CLIENT_ID") {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "instagram_not_configured"
        })),
    };

    let client_secret = match std::env::var("INSTAGRAM_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "instagram_not_configured"
        })),
    };

    let redirect_uri = format!("{}/auth/oauth/callback/instagram",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

    let instagram_client = auth_service::instagram_oauth::InstagramOAuthClient::new(
        auth_service::instagram_oauth::InstagramConfig {
            client_id,
            client_secret,
            redirect_uri,
        }
    );

    // Exchange code for token
    let token_response = match instagram_client.exchange_code(code).await {
        Ok(token) => token,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_authorization_code"
        })),
    };

    // Get user profile from Instagram
    let user_info = match instagram_client.get_user_info(&token_response.access_token).await {
        Ok(info) => info,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "failed_to_fetch_user_info"
        })),
    };

    // Get engagement stats
    let stats = match instagram_client.get_media_insights(&token_response.access_token).await {
        Ok(s) => s,
        Err(_) => auth_service::instagram_oauth::InstagramMediaInsights {
            impressions: None,
            reach: None,
            engagement: None,
        },
    };

    // Create or update user
    let user_id: i64 = match sqlx::query_scalar(
        r#"
        INSERT INTO users (email, provider, provider_id, name, profile_picture, created_at, updated_at)
        VALUES ($1, 'instagram', $2, $3, $4, NOW(), NOW())
        ON CONFLICT (provider, provider_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(format!("{}@instagram.local", user_info.username))
    .bind(&user_info.id)
    .bind(&user_info.username)
    .bind(&user_info.profile_picture_url)
    .fetch_one(pool)
    .await {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error"
        })),
    };

    // Create or update persona (creator profile)
    let _persona: Option<i64> = sqlx::query_scalar(
        r#"
        INSERT INTO personas (user_id, platform, platform_handle, followers, engagement_rate, bio, profile_picture_url, created_at, updated_at)
        VALUES ($1, 'instagram', $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (user_id, platform) DO UPDATE SET followers = $3, engagement_rate = $4, updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind("instagram")
    .bind(&user_info.username)
    .bind(user_info.followers_count.unwrap_or(0))
    .bind(0.0) // Engagement rate calculated from insights
    .bind(&user_info.biography)
    .bind(&user_info.profile_picture_url)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    // Create JWT token
    let jwt_token = match auth_service::token::create_token(user_id, "creator") {
        Ok(token) => token,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "token_generation_failed"
        })),
    };

    HttpResponse::Ok().json(OAuthLoginResponse {
        jwt_token,
        user_id,
        persona_id: _persona.unwrap_or(0),
        platform: "instagram".to_string(),
        username: Some(user_info.username),
        profile_picture: user_info.profile_picture_url,
    })
}

/// Handle YouTube OAuth callback
async fn handle_youtube_callback(code: &str, pool: &PgPool) -> HttpResponse {
    let client_id = match std::env::var("YOUTUBE_CLIENT_ID") {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "youtube_not_configured"
        })),
    };

    let client_secret = match std::env::var("YOUTUBE_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "youtube_not_configured"
        })),
    };

    let redirect_uri = format!("{}/auth/oauth/callback/youtube",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

    let youtube_client = auth_service::youtube_oauth::YouTubeOAuthClient::new(
        auth_service::youtube_oauth::YouTubeConfig {
            client_id,
            client_secret,
            redirect_uri,
        }
    );

    let token_response = match youtube_client.exchange_code(code).await {
        Ok(token) => token,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_authorization_code"
        })),
    };

    let channel_info = match youtube_client.get_channel_info(&token_response.access_token).await {
        Ok(info) => info,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "failed_to_fetch_user_info"
        })),
    };

    let stats = match youtube_client.get_channel_stats(&token_response.access_token).await {
        Ok(s) => s,
        Err(_) => auth_service::youtube_oauth::YouTubeChannelStats {
            subscriber_count: None,
            view_count: None,
            video_count: None,
        },
    };

    let user_id: i64 = match sqlx::query_scalar(
        r#"
        INSERT INTO users (email, provider, provider_id, name, profile_picture, created_at, updated_at)
        VALUES ($1, 'youtube', $2, $3, $4, NOW(), NOW())
        ON CONFLICT (provider, provider_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(format!("{}@youtube.local", channel_info.title))
    .bind(&channel_info.id)
    .bind(&channel_info.title)
    .bind(&channel_info.thumbnail_url)
    .fetch_one(pool)
    .await {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error"
        })),
    };

    let subscriber_count: i64 = stats.subscriber_count.and_then(|s| s.parse().ok()).unwrap_or(0);

    let _persona: Option<i64> = sqlx::query_scalar(
        r#"
        INSERT INTO personas (user_id, platform, platform_handle, followers, bio, profile_picture_url, created_at, updated_at)
        VALUES ($1, 'youtube', $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_id, platform) DO UPDATE SET followers = $3, updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind("youtube")
    .bind(&channel_info.title)
    .bind(subscriber_count)
    .bind(&channel_info.description)
    .bind(&channel_info.thumbnail_url)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let jwt_token = match auth_service::token::create_token(user_id, "creator") {
        Ok(token) => token,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "token_generation_failed"
        })),
    };

    HttpResponse::Ok().json(OAuthLoginResponse {
        jwt_token,
        user_id,
        persona_id: _persona.unwrap_or(0),
        platform: "youtube".to_string(),
        username: Some(channel_info.title),
        profile_picture: channel_info.thumbnail_url,
    })
}

/// Handle TikTok OAuth callback
async fn handle_tiktok_callback(code: &str, pool: &PgPool) -> HttpResponse {
    let client_key = match std::env::var("TIKTOK_CLIENT_KEY") {
        Ok(key) => key,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "tiktok_not_configured"
        })),
    };

    let client_secret = match std::env::var("TIKTOK_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "tiktok_not_configured"
        })),
    };

    let redirect_uri = format!("{}/auth/oauth/callback/tiktok",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

    let tiktok_client = auth_service::tiktok_oauth::TikTokOAuthClient::new(
        auth_service::tiktok_oauth::TikTokConfig {
            client_key,
            client_secret,
            redirect_uri,
        }
    );

    let token_response = match tiktok_client.exchange_code(code).await {
        Ok(token) => token,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_authorization_code"
        })),
    };

    let user_info = match tiktok_client.get_user_info(&token_response.access_token, &token_response.open_id).await {
        Ok(info) => info,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "failed_to_fetch_user_info"
        })),
    };

    let stats = match tiktok_client.get_user_stats(&token_response.access_token).await {
        Ok(s) => s,
        Err(_) => auth_service::tiktok_oauth::TikTokUserStats {
            follower_count: None,
            following_count: None,
            video_count: None,
            heart_count: None,
        },
    };

    let user_id: i64 = match sqlx::query_scalar(
        r#"
        INSERT INTO users (email, provider, provider_id, name, profile_picture, created_at, updated_at)
        VALUES ($1, 'tiktok', $2, $3, $4, NOW(), NOW())
        ON CONFLICT (provider, provider_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(format!("{}@tiktok.local", user_info.display_name))
    .bind(&user_info.open_id)
    .bind(&user_info.display_name)
    .bind(&user_info.avatar_large_url)
    .fetch_one(pool)
    .await {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error"
        })),
    };

    let _persona: Option<i64> = sqlx::query_scalar(
        r#"
        INSERT INTO personas (user_id, platform, platform_handle, followers, bio, profile_picture_url, created_at, updated_at)
        VALUES ($1, 'tiktok', $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_id, platform) DO UPDATE SET followers = $3, updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind("tiktok")
    .bind(&user_info.display_name)
    .bind(stats.follower_count.unwrap_or(0))
    .bind(&user_info.biography)
    .bind(&user_info.avatar_large_url)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let jwt_token = match auth_service::token::create_token(user_id, "creator") {
        Ok(token) => token,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "token_generation_failed"
        })),
    };

    HttpResponse::Ok().json(OAuthLoginResponse {
        jwt_token,
        user_id,
        persona_id: _persona.unwrap_or(0),
        platform: "tiktok".to_string(),
        username: Some(user_info.display_name),
        profile_picture: user_info.avatar_large_url,
    })
}

/// Handle LinkedIn OAuth callback
async fn handle_linkedin_callback(code: &str, pool: &PgPool) -> HttpResponse {
    let client_id = match std::env::var("LINKEDIN_CLIENT_ID") {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "linkedin_not_configured"
        })),
    };

    let client_secret = match std::env::var("LINKEDIN_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "linkedin_not_configured"
        })),
    };

    let redirect_uri = format!("{}/auth/oauth/callback/linkedin",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()));

    let linkedin_client = auth_service::linkedin_oauth::LinkedInOAuthClient::new(
        auth_service::linkedin_oauth::LinkedInConfig {
            client_id,
            client_secret,
            redirect_uri,
        }
    );

    let token_response = match linkedin_client.exchange_code(code).await {
        Ok(token) => token,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_authorization_code"
        })),
    };

    let user_info = match linkedin_client.get_user_info(&token_response.access_token).await {
        Ok(info) => info,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "failed_to_fetch_user_info"
        })),
    };

    let display_name = format!("{} {}", user_info.first_name, user_info.last_name);
    let email = user_info.email.unwrap_or_else(|| format!("{}@linkedin.local", display_name.replace(" ", ".")));

    let user_id: i64 = match sqlx::query_scalar(
        r#"
        INSERT INTO users (email, provider, provider_id, name, profile_picture, created_at, updated_at)
        VALUES ($1, 'linkedin', $2, $3, $4, NOW(), NOW())
        ON CONFLICT (provider, provider_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(&email)
    .bind(&user_info.id)
    .bind(&display_name)
    .bind(&user_info.profile_picture_url)
    .fetch_one(pool)
    .await {
        Ok(id) => id,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error"
        })),
    };

    let _persona: Option<i64> = sqlx::query_scalar(
        r#"
        INSERT INTO personas (user_id, platform, platform_handle, bio, profile_picture_url, created_at, updated_at)
        VALUES ($1, 'linkedin', $2, $3, $4, NOW(), NOW())
        ON CONFLICT (user_id, platform) DO UPDATE SET updated_at = NOW()
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind("linkedin")
    .bind(&display_name)
    .bind(&user_info.headline)
    .bind(&user_info.profile_picture_url)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let jwt_token = match auth_service::token::create_token(user_id, "creator") {
        Ok(token) => token,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "token_generation_failed"
        })),
    };

    HttpResponse::Ok().json(OAuthLoginResponse {
        jwt_token,
        user_id,
        persona_id: _persona.unwrap_or(0),
        platform: "linkedin".to_string(),
        username: Some(display_name),
        profile_picture: user_info.profile_picture_url,
    })
}
