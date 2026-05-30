use actix_web::{web, HttpMessage, HttpResponse, Responder};
use actix_web::cookie::{Cookie, SameSite};
use actix_web::cookie::time::Duration as CookieDuration;
use serde::Deserialize;
use sqlx::PgPool;
use tracing::{info, error, warn};
use auth_service::verify::verify_instagram_token;
use auth_service::token::TokenManager;

/// Build a session cookie for the given token.
/// `secure` should be true in production (HTTPS only).
fn session_cookie(token: &str, secure: bool) -> Cookie<'static> {
    Cookie::build("valueskins_session", token.to_owned())
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(CookieDuration::hours(24))
        .finish()
}

fn is_production() -> bool {
    std::env::var("APP_ENV").map(|v| v == "production").unwrap_or(false)
}

fn redirect_uri_allowed(redirect_uri: &str) -> bool {
    // Default-safe allowlist for production and local development callback.
    let allowlist = std::env::var("OAUTH_REDIRECT_ALLOWLIST")
        .unwrap_or_else(|_| "http://localhost:3000/auth/callback,https://valueskins.io/auth/callback,https://www.valueskins.io/auth/callback".to_string());
    allowlist
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .any(|entry| entry == redirect_uri)
}

fn valid_refresh_token_shape(token: &str) -> bool {
    let t = token.trim();
    let len_ok = (32..=4096).contains(&t.len());
    // Keep permissive but bounded and printable; blocks control-byte abuse.
    let charset_ok = t.chars().all(|c| c.is_ascii_graphic());
    len_ok && charset_ok
}

#[cfg(test)]
mod tests {
    use super::{redirect_uri_allowed, valid_refresh_token_shape};

    #[test]
    fn redirect_allowlist_defaults_allow_known_urls() {
        std::env::remove_var("OAUTH_REDIRECT_ALLOWLIST");
        assert!(redirect_uri_allowed("http://localhost:3000/auth/callback"));
        assert!(redirect_uri_allowed("https://valueskins.io/auth/callback"));
    }

    #[test]
    fn redirect_allowlist_rejects_unknown_urls() {
        std::env::remove_var("OAUTH_REDIRECT_ALLOWLIST");
        assert!(!redirect_uri_allowed("https://evil.example.com/callback"));
        assert!(!redirect_uri_allowed("http://localhost:3000/other"));
    }

    #[test]
    fn refresh_token_shape_validation() {
        assert!(valid_refresh_token_shape("abcDEF123._-xyzXYZ9876543210abcDEF123._-xyzXYZ9"));
        assert!(!valid_refresh_token_shape("short"));
        assert!(!valid_refresh_token_shape(&"x".repeat(5000)));
        assert!(!valid_refresh_token_shape("token with spaces"));
    }
}

#[derive(Deserialize)]
pub struct LoginRequest {
    /// Instagram access token (direct token flow, kept for backward compatibility)
    access_token: Option<String>,
    /// OAuth authorization code (code exchange flow)
    code: Option<String>,
    /// redirect_uri used in the OAuth flow; required when `code` is provided
    redirect_uri: Option<String>,
    role: String,
}

/// Exchange an Instagram authorization code for a short-lived access token.
///
/// POST https://api.instagram.com/oauth/access_token
/// with form-urlencoded: client_id, client_secret, grant_type, redirect_uri, code
///
/// Returns the short-lived token and the user_id on success.
async fn exchange_instagram_code(code: &str, redirect_uri: &str) -> Result<String, String> {
    let client_id = std::env::var("INSTAGRAM_CLIENT_ID")
        .map_err(|_| "INSTAGRAM_CLIENT_ID not configured".to_string())?;
    let client_secret = std::env::var("INSTAGRAM_CLIENT_SECRET")
        .map_err(|_| "INSTAGRAM_CLIENT_SECRET not configured".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    #[derive(Deserialize)]
    struct TokenResponse {
        access_token: String,
        #[allow(dead_code)]
        user_id: Option<u64>,
    }

    #[derive(Deserialize)]
    struct ErrorDetail {
        message: Option<String>,
        error_type: Option<String>,
    }

    #[derive(Deserialize)]
    struct ErrorResponse {
        error: Option<ErrorDetail>,
        error_message: Option<String>,
    }

    let response = client
        .post("https://api.instagram.com/oauth/access_token")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
            ("code", code),
        ])
        .send()
        .await
        .map_err(|e| format!("Instagram token exchange network error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body_text = response.text().await.unwrap_or_default();
        // Attempt to parse structured error
        if let Ok(err_resp) = serde_json::from_str::<ErrorResponse>(&body_text) {
            let msg = err_resp.error
                .and_then(|e| e.message)
                .or(err_resp.error_message)
                .unwrap_or_else(|| body_text.clone());
            return Err(format!("Instagram token exchange failed ({}): {}", status, msg));
        }
        return Err(format!("Instagram token exchange failed ({}): {}", status, body_text));
    }

    let token_resp: TokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Instagram token response: {}", e))?;

    Ok(token_resp.access_token)
}

/// POST /auth/login
///
/// Authenticates a user via Instagram OAuth.
///
/// Accepts either:
///   1. { code, redirect_uri, role } -- Authorization code flow (preferred).
///      The backend exchanges the code with Instagram for an access token.
///   2. { access_token, role } -- Direct token flow (backward-compatible).
///      The backend verifies the token against the Graph API.
///
/// In both cases:
///   - Calls Meta Graph API to verify the token and get profile
///   - Upserts the user in the database (creates on first login)
///   - Creates/updates a persona for the user
///   - Issues a JWT with user_id, ig_user_id, role, and persona_id
pub async fn login(
    req: web::Json<LoginRequest>,
    pool: web::Data<PgPool>,
    token_manager: web::Data<TokenManager>,
) -> impl Responder {
    let role = req.role.as_str();
    if role != "creator" && role != "brand" {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Role must be 'creator' or 'brand'"
        }));
    }

    if req.code.is_some() && req.access_token.is_some() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Provide either 'code' or 'access_token', not both"
        }));
    }

    if let Some(code) = req.code.as_ref() {
        if code.trim().is_empty() || code.len() > 4096 {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid OAuth code"
            }));
        }
    }

    if let Some(token) = req.access_token.as_ref() {
        if token.trim().is_empty() || token.len() > 8192 {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid Instagram access token"
            }));
        }
    }

    // Resolve the Instagram access token from either the code or direct token
    let access_token: String = if let Some(ref code) = req.code {
        let redirect_uri = match &req.redirect_uri {
            Some(uri) => uri.clone(),
            None => {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "redirect_uri is required when using authorization code flow"
                }));
            }
        };

        // Validate redirect_uri format and enforce strict allowlist.
        if (!redirect_uri.starts_with("https://") && !redirect_uri.starts_with("http://localhost"))
            || !redirect_uri_allowed(&redirect_uri)
        {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "redirect_uri is not allowed"
            }));
        }

        info!("Exchanging Instagram authorization code for access token");
        match exchange_instagram_code(code, &redirect_uri).await {
            Ok(token) => token,
            Err(e) => {
                error!("Instagram code exchange failed: {}", e);
                return HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": "Failed to exchange authorization code with Instagram"
                }));
            }
        }
    } else if let Some(ref token) = req.access_token {
        token.clone()
    } else {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Either 'code' (with 'redirect_uri') or 'access_token' must be provided"
        }));
    };

    // Step 1: Verify Instagram token with Meta Graph API
    let profile = match verify_instagram_token(&access_token).await {
        Ok(profile) => profile,
        Err(e) => {
            error!("Instagram token verification failed: {:?}", e);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Invalid Instagram access token"
            }));
        }
    };

    info!("Instagram user verified: @{} (id: {})", profile.username, profile.id);

    // Extract fields from profile before it's partially moved
    let ig_user_id = profile.id;
    let username = profile.username;
    let display_name = profile.name.unwrap_or_else(|| username.clone());
    let avatar_url = profile.profile_picture_url;
    let followers_count = profile.followers_count;

    // Step 2: Upsert user in database
    let user_id: i64 = match sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO users (instagram_user_id, username, display_name, avatar_url, role, followers_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (instagram_user_id) DO UPDATE SET
            username = EXCLUDED.username,
            display_name = COALESCE(EXCLUDED.display_name, users.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
            role = EXCLUDED.role,
            followers_count = COALESCE(EXCLUDED.followers_count, users.followers_count),
            last_login_at = NOW()
        RETURNING id
        "#
    )
    .bind(&ig_user_id)
    .bind(&username)
    .bind(&display_name)
    .bind(&avatar_url)
    .bind(role)
    .bind(followers_count)
    .fetch_one(pool.get_ref())
    .await {
        Ok(id) => id,
        Err(e) => {
            error!("Failed to upsert user: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create user account"
            }));
        }
    };

    // Step 3: Upsert persona (public-facing identity)
    let persona_id: Option<i64> = match sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO personas (owner_user_id, owner_address, display_name, avatar_uri, created_at, last_active_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (owner_user_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            avatar_uri = COALESCE(EXCLUDED.avatar_uri, personas.avatar_uri),
            last_active_at = NOW()
        RETURNING id
        "#
    )
    .bind(user_id)
    .bind(&ig_user_id)
    .bind(&display_name)
    .bind(&avatar_url)
    .fetch_optional(pool.get_ref())
    .await {
        Ok(id) => id,
        Err(e) => {
            warn!("Failed to upsert persona (non-fatal): {:?}", e);
            None
        }
    };

    // Step 4: Create JWT
    let token = match token_manager.create_token(user_id, &ig_user_id, role, persona_id) {
        Ok(token) => token,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create session token"
            }));
        }
    };

    // Step 5: Issue refresh token (stored hashed in DB)
    let refresh_service = pool.get_ref().clone();
    let refresh_svc = shared::refresh_tokens::RefreshTokenService::new(refresh_service);
    let refresh_pair = match refresh_svc.create(user_id, None, None).await {
        Ok(pair) => pair,
        Err(e) => {
            error!("Failed to create refresh token: {:?}", e);
            // Non-fatal: return JWT without refresh token, still set cookie
            return HttpResponse::Ok()
                .cookie(session_cookie(&token, is_production()))
                .json(serde_json::json!({
                    "token": token,
                    "user": {
                        "id": user_id,
                        "instagram_user_id": ig_user_id,
                        "username": username,
                        "display_name": display_name,
                        "avatar_url": avatar_url,
                        "role": role,
                        "persona_id": persona_id,
                    }
                }));
        }
    };

    HttpResponse::Ok()
        .cookie(session_cookie(&token, is_production()))
        .json(serde_json::json!({
            "token": token,
            "refresh_token": refresh_pair.refresh_token,
            "user": {
                "id": user_id,
                "instagram_user_id": ig_user_id,
                "username": username,
                "display_name": display_name,
                "avatar_url": avatar_url,
                "role": role,
                "persona_id": persona_id,
            }
        }))
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    refresh_token: String,
}

/// POST /auth/refresh — rotate refresh token, issue new JWT
pub async fn refresh_token(
    req: web::Json<RefreshRequest>,
    pool: web::Data<PgPool>,
    token_manager: web::Data<TokenManager>,
) -> impl Responder {
    if !valid_refresh_token_shape(&req.refresh_token) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid refresh token format"
        }));
    }

    let refresh_svc = shared::refresh_tokens::RefreshTokenService::new(pool.get_ref().clone());

    let pair = match refresh_svc.rotate(&req.refresh_token, None, None).await {
        Ok(pair) => pair,
        Err(shared::refresh_tokens::RefreshError::ReuseDetected) => {
            warn!("Refresh token reuse detected — all sessions revoked");
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Session compromised — all sessions revoked. Please log in again."
            }));
        }
        Err(e) => {
            warn!("Refresh token validation failed: {}", e);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Invalid or expired refresh token"
            }));
        }
    };

    // Look up user to re-issue JWT
    let user: Option<(i64, String, String, Option<i64>)> = sqlx::query_as(
        "SELECT u.id, u.instagram_user_id, u.role, p.id
         FROM users u LEFT JOIN personas p ON p.owner_user_id = u.id
         WHERE u.id = (SELECT user_id FROM refresh_tokens WHERE token_hash = $1 LIMIT 1)"
    )
    .bind(&shared::refresh_tokens::RefreshTokenService::hash_token_public(&req.refresh_token))
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten();

    // Fallback: look up by new token's family
    let (user_id, ig_user_id, role, persona_id) = match user {
        Some(u) => u,
        None => {
            // Use the user_id from the refresh token table directly
            match sqlx::query_as::<_, (i64, String, String, Option<i64>)>(
                "SELECT u.id, u.instagram_user_id, u.role, p.id
                 FROM refresh_tokens rt
                 JOIN users u ON u.id = rt.user_id
                 LEFT JOIN personas p ON p.owner_user_id = u.id
                 WHERE rt.family_id = $1
                 ORDER BY rt.created_at DESC LIMIT 1"
            )
            .bind(pair.family_id)
            .fetch_optional(pool.get_ref())
            .await {
                Ok(Some(u)) => u,
                _ => {
                    return HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to resolve user for token refresh"
                    }));
                }
            }
        }
    };

    let jwt = match token_manager.create_token(user_id, &ig_user_id, &role, persona_id) {
        Ok(t) => t,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create session token"
            }));
        }
    };

    HttpResponse::Ok()
        .cookie(session_cookie(&jwt, is_production()))
        .json(serde_json::json!({
            "token": jwt,
            "refresh_token": pair.refresh_token,
        }))
}

#[derive(Deserialize)]
pub struct LogoutRequest {
    refresh_token: Option<String>,
    logout_all: Option<bool>,
}

/// POST /auth/logout — revoke refresh token(s)
pub async fn logout(
    req: web::Json<LogoutRequest>,
    pool: web::Data<PgPool>,
    http_req: actix_web::HttpRequest,
) -> impl Responder {
    let refresh_svc = shared::refresh_tokens::RefreshTokenService::new(pool.get_ref().clone());

    if req.logout_all.unwrap_or(false) {
        // Extract user_id from JWT claims in request extensions
        if let Some(claims) = http_req.extensions().get::<auth_service::token::Claims>() {
            let uid = match claims.sub.parse::<i64>() {
                Ok(v) if v > 0 => v,
                _ => {
                    return HttpResponse::Unauthorized().json(serde_json::json!({
                        "error": "Invalid authentication token"
                    }));
                }
            };
            match refresh_svc.revoke_all_for_user(uid).await {
                Ok(n) => {
                    info!(user_id = uid, revoked = n, "All sessions revoked");
                    let expired_cookie = Cookie::build("valueskins_session", "")
                        .http_only(true)
                        .secure(is_production())
                        .same_site(SameSite::Lax)
                        .path("/")
                        .max_age(CookieDuration::ZERO)
                        .finish();
                    return HttpResponse::Ok()
                        .cookie(expired_cookie)
                        .json(serde_json::json!({
                            "message": "All sessions revoked",
                            "revoked_count": n
                        }));
                }
                Err(e) => {
                    error!("Failed to revoke all sessions: {:?}", e);
                    return HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to revoke sessions"
                    }));
                }
            }
        }
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Authentication required for logout-all"
        }));
    }

    if let Some(ref token) = req.refresh_token {
        if !valid_refresh_token_shape(token) {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid refresh token format"
            }));
        }
        if let Err(e) = refresh_svc.revoke(token).await {
            error!("Failed to revoke refresh token: {:?}", e);
        }
    }

    // Expire the httpOnly session cookie by setting Max-Age=0.
    // This is the only reliable way to clear an httpOnly cookie from the browser.
    let expired_cookie = Cookie::build("valueskins_session", "")
        .http_only(true)
        .secure(is_production())
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(CookieDuration::ZERO)
        .finish();

    HttpResponse::Ok()
        .cookie(expired_cookie)
        .json(serde_json::json!({ "message": "Logged out" }))
}
