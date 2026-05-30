use actix_web::{web, HttpRequest, HttpResponse, HttpResponseBuilder, HttpMessage};
use actix_web::cookie::{Cookie, SameSite};
use actix_web::cookie::time::Duration as CookieDuration;
use serde::Deserialize;
use sqlx::PgPool;

use auth_service::session::SessionManager;
use auth_service::two_factor::TwoFactorService;
use auth_service::phone_auth::PhoneAuthStore;
use auth_service::token::TokenManager;
use account_service::service::AccountService;

#[derive(Deserialize)]
struct GoogleClaims {
    sub: String,
    email: Option<String>,
    exp: usize,
}

fn decode_google_token(token: &str) -> Result<GoogleClaims, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format".into());
    }
    use base64::Engine as _;
    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|_| "Invalid JWT payload encoding".to_string())?;
    let claims: GoogleClaims = serde_json::from_slice(&payload)
        .map_err(|_| "Invalid JWT claims".to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as usize;
    if claims.exp <= now {
        return Err("Token expired".into());
    }
    Ok(claims)
}

fn session_cookie(token: &str, secure: bool) -> Cookie<'static> {
    Cookie::build("valueskins_session", token.to_owned())
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Strict)
        .path("/")
        .max_age(CookieDuration::minutes(15))
        .finish()
}

fn refresh_cookie(token: &str, secure: bool) -> Cookie<'static> {
    Cookie::build("valueskins_refresh", token.to_owned())
        .http_only(true)
        .secure(secure)
        .same_site(SameSite::Strict)
        .path("/api/auth")
        .max_age(CookieDuration::days(30))
        .finish()
}

fn clear_cookies(secure: bool) -> Vec<Cookie<'static>> {
    vec![
        Cookie::build("valueskins_session", "")
            .http_only(true)
            .secure(secure)
            .same_site(SameSite::Strict)
            .path("/")
            .max_age(CookieDuration::ZERO)
            .finish(),
        Cookie::build("valueskins_refresh", "")
            .http_only(true)
            .secure(secure)
            .same_site(SameSite::Strict)
            .path("/api/auth")
            .max_age(CookieDuration::ZERO)
            .finish(),
    ]
}

fn is_production() -> bool {
    std::env::var("APP_ENV").map(|v| v == "production").unwrap_or(false)
}

fn extract_client_info(req: &HttpRequest) -> (serde_json::Value, Option<std::net::IpAddr>) {
    let device_info = serde_json::json!({
        "user_agent": req.headers().get("User-Agent").and_then(|v| v.to_str().ok()).unwrap_or("unknown"),
        "ip": req.peer_addr().map(|a| a.ip().to_string()).unwrap_or_default(),
    });
    let ip = req.peer_addr().map(|a| a.ip());
    (device_info, ip)
}

// ── POST /auth/unified/signup ──

#[derive(Deserialize)]
pub struct OAuthSignupRequest {
    pub google_token: String,
    pub display_name: String,
}

pub async fn signup(
    req: HttpRequest,
    body: web::Json<OAuthSignupRequest>,
    pool: web::Data<PgPool>,
    token_manager: web::Data<TokenManager>,
) -> HttpResponse {
    let secure = is_production();
    let svc = AccountService::new(pool.get_ref().clone());

    let claims = match decode_google_token(&body.google_token) {
        Ok(c) => c,
        Err(e) => return HttpResponse::BadRequest().json(serde_json::json!({"error": e})),
    };

    let dn = body.display_name.trim();
    if dn.is_empty() || dn.len() > 100 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Display name must be 1-100 characters"
        }));
    }

    let account = match svc.get_or_create_account(
        claims.email.as_deref(),
        Some(&claims.sub),
        None,
        dn,
    ).await {
        Ok(a) => a,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    };

    let _ = svc.update_last_login(account.id, req.peer_addr().map(|a| a.ip())).await;

    let account_resp = match svc.get_account_with_modules(account.id).await {
        Ok(a) => a,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to load account"})),
    };

    let modules: Vec<String> = account_resp.modules.iter().map(|m| m.code.clone()).collect();
    let permissions: Vec<String> = svc.get_permissions(account.id).await.unwrap_or_default();

    let jwt = match token_manager.create_account_token(
        account.id,
        account_resp.email.clone(),
        account_resp.email_verified,
        modules,
        permissions,
        Some(account.id),
        None,
    ) {
        Ok(t) => t,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to create token"})),
    };

    let (device_info, ip) = extract_client_info(&req);
    let session_mgr = SessionManager::new(pool.get_ref().clone());
    let (session_id, refresh_token) = match session_mgr.create_session(account.id, &device_info, ip).await {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Session error: {:?}", e)})),
    };

    HttpResponse::Created()
        .cookie(session_cookie(&jwt, secure))
        .cookie(refresh_cookie(&refresh_token, secure))
        .insert_header(("X-Session-Id", session_id.to_string()))
        .json(serde_json::json!({
            "account": account_resp,
            "session_id": session_id,
        }))
}

// ── POST /auth/unified/login ──

#[derive(Deserialize)]
pub struct OAuthLoginRequest {
    pub google_token: String,
    pub totp_code: Option<String>,
}

pub async fn login(
    req: HttpRequest,
    body: web::Json<OAuthLoginRequest>,
    pool: web::Data<PgPool>,
    token_manager: web::Data<TokenManager>,
) -> HttpResponse {
    let secure = is_production();
    let svc = AccountService::new(pool.get_ref().clone());

    let claims = match decode_google_token(&body.google_token) {
        Ok(c) => c,
        Err(e) => return HttpResponse::BadRequest().json(serde_json::json!({"error": e})),
    };

    let row = match sqlx::query_as::<_, (i64, bool)>(
        "SELECT id, totp_enabled FROM accounts WHERE google_sub = $1 AND is_active = TRUE"
    )
    .bind(&claims.sub)
    .fetch_optional(pool.get_ref())
    .await {
        Ok(Some(r)) => r,
        Ok(None) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "No account found with this Google account. Please sign up first."})),
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"})),
    };

    if row.1 {
        match body.totp_code {
            Some(ref code) => {
                let secret: Option<String> = sqlx::query_scalar(
                    "SELECT totp_secret FROM accounts WHERE id = $1"
                )
                .bind(row.0)
                .fetch_optional(pool.get_ref())
                .await
                .ok()
                .flatten();
                match secret {
                    Some(ref s) if TwoFactorService::verify_totp(s, code, 1) => {},
                    _ => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid 2FA code"})),
                }
            }
            None => {
                return HttpResponse::Ok().json(serde_json::json!({
                    "requires_2fa": true,
                    "session_token": body.google_token.clone(),
                }));
            }
        }
    }

    let account_id = row.0;

    let _ = svc.update_last_login(account_id, req.peer_addr().map(|a| a.ip())).await;

    let account_resp = match svc.get_account_with_modules(account_id).await {
        Ok(a) => a,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to load account"})),
    };

    let modules: Vec<String> = account_resp.modules.iter().map(|m| m.code.clone()).collect();
    let permissions: Vec<String> = svc.get_permissions(account_id).await.unwrap_or_default();

    let jwt = match token_manager.create_account_token(
        account_id,
        account_resp.email.clone(),
        account_resp.email_verified,
        modules,
        permissions,
        Some(account_id),
        None,
    ) {
        Ok(t) => t,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to create token"})),
    };

    let (device_info, ip) = extract_client_info(&req);
    let session_mgr = SessionManager::new(pool.get_ref().clone());
    let (session_id, refresh_token) = match session_mgr.create_session(account_id, &device_info, ip).await {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Session error: {:?}", e)})),
    };

    HttpResponse::Ok()
        .cookie(session_cookie(&jwt, secure))
        .cookie(refresh_cookie(&refresh_token, secure))
        .insert_header(("X-Session-Id", session_id.to_string()))
        .json(serde_json::json!({
            "account": account_resp,
            "session_id": session_id,
        }))
}

// ── POST /auth/dev/login ──
// Dev-only: bypasses Google OAuth. Creates/returns a dev account with all modules.

pub async fn dev_login(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    token_manager: web::Data<TokenManager>,
) -> HttpResponse {
    let env = std::env::var("APP_ENV").unwrap_or_default();
    if env == "production" {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": "Dev login not available in production"}));
    }

    let secure = is_production();
    let svc = AccountService::new(pool.get_ref().clone());

    let dev_sub = "dev_user";
    let dev_email = "dev@valueskins.local";

    let existing = sqlx::query_as::<_, (i64,)>(
        "SELECT id FROM accounts WHERE google_sub = $1"
    )
    .bind(dev_sub)
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten();

    let account_id = match existing {
        Some((id,)) => id,
        None => {
            let row = sqlx::query_as::<_, (i64,)>(
                "INSERT INTO accounts (email, google_sub, display_name, email_verified, onboarding_stage)
                 VALUES ($1, $2, $3, TRUE, 'complete')
                 RETURNING id"
            )
            .bind(dev_email)
            .bind(dev_sub)
            .bind("Dev User")
            .fetch_one(pool.get_ref())
            .await;

            match row {
                Ok(r) => r.0,
                Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to create dev account"})),
            }
        }
    };

    // Ensure all modules are active for the dev account
    for module in &["explorer", "host", "valueskin", "brand", "community"] {
        let _ = sqlx::query(
            "INSERT INTO user_modules (account_id, module_code, is_active)
             VALUES ($1, $2, TRUE)
             ON CONFLICT (account_id, module_code) DO UPDATE SET is_active = TRUE"
        )
        .bind(account_id)
        .bind(module)
        .execute(pool.get_ref())
        .await;
    }

    let _ = svc.update_last_login(account_id, req.peer_addr().map(|a| a.ip())).await;

    let account_resp = match svc.get_account_with_modules(account_id).await {
        Ok(a) => a,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to load account"})),
    };

    let modules: Vec<String> = account_resp.modules.iter().map(|m| m.code.clone()).collect();
    let permissions: Vec<String> = svc.get_permissions(account_id).await.unwrap_or_default();

    let jwt = match token_manager.create_account_token(
        account_id,
        account_resp.email.clone(),
        account_resp.email_verified,
        modules,
        permissions,
        Some(account_id),
        None,
    ) {
        Ok(t) => t,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to create token"})),
    };

    let (device_info, ip) = extract_client_info(&req);
    let session_mgr = SessionManager::new(pool.get_ref().clone());
    let (session_id, refresh_token) = match session_mgr.create_session(account_id, &device_info, ip).await {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Session error: {:?}", e)})),
    };

    HttpResponse::Ok()
        .cookie(session_cookie(&jwt, secure))
        .cookie(refresh_cookie(&refresh_token, secure))
        .insert_header(("X-Session-Id", session_id.to_string()))
        .json(serde_json::json!({
            "account": account_resp,
            "session_id": session_id,
        }))
}

// ── POST /auth/unified/refresh ──

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: Option<String>,
}

pub async fn refresh(
    req: HttpRequest,
    body: web::Json<RefreshRequest>,
    pool: web::Data<PgPool>,
    token_manager: web::Data<TokenManager>,
) -> HttpResponse {
    let secure = is_production();
    let svc = AccountService::new(pool.get_ref().clone());

    let refresh_token = body.refresh_token.clone()
        .or_else(|| {
            req.headers().get("Cookie")
                .and_then(|v| v.to_str().ok())
                .and_then(|c| {
                    c.split(';')
                        .find(|part| part.trim().starts_with("valueskins_refresh="))
                        .and_then(|part| part.split('=').nth(1))
                        .map(|s| s.trim().to_string())
                })
        });

    let token = match refresh_token {
        Some(t) if !t.is_empty() => t,
        _ => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Refresh token required"})),
    };

    let session_mgr = SessionManager::new(pool.get_ref().clone());

    match session_mgr.rotate_token(&token).await {
        Ok((new_session_id, new_refresh_token)) => {
            let account_id = match session_mgr.get_account_id(&new_refresh_token).await {
                Ok(id) => id,
                Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Session invalid"})),
            };

            let account_resp = match svc.get_account_with_modules(account_id).await {
                Ok(a) => a,
                Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to load account"})),
            };

            let modules: Vec<String> = account_resp.modules.iter().map(|m| m.code.clone()).collect();
            let permissions: Vec<String> = svc.get_permissions(account_id).await.unwrap_or_default();

            let jwt = match token_manager.create_account_token(
                account_id,
                account_resp.email.clone(),
                account_resp.email_verified,
                modules,
                permissions,
                Some(account_id),
                None,
            ) {
                Ok(t) => t,
                Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to create token"})),
            };

            HttpResponse::Ok()
                .cookie(session_cookie(&jwt, secure))
                .cookie(refresh_cookie(&new_refresh_token, secure))
                .insert_header(("X-Session-Id", new_session_id.to_string()))
                .json(serde_json::json!({
                    "message": "Token refreshed",
                    "session_id": new_session_id,
                }))
        }
        Err(auth_service::session::SessionError::TokenTheft) => {
            let mut resp = actix_web::HttpResponseBuilder::new(actix_web::http::StatusCode::UNAUTHORIZED);
            for cookie in clear_cookies(secure) {
                resp.cookie(cookie);
            }
            resp.json(serde_json::json!({
                "error": "Session compromised — all sessions revoked. Please log in again."
            }))
        }
        Err(e) => HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    }
}

// ── POST /auth/unified/logout ──

#[derive(Deserialize)]
pub struct LogoutRequest {
    pub logout_all: Option<bool>,
}

pub async fn logout(
    req: HttpRequest,
    body: web::Json<LogoutRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let secure = is_production();
    let session_mgr = SessionManager::new(pool.get_ref().clone());

    if body.logout_all.unwrap_or(false) {
        if let Some(claims) = req.extensions().get::<auth_service::token::Claims>() {
            if let Ok(account_id) = claims.sub.parse::<i64>() {
                let _ = session_mgr.revoke_all_sessions(account_id).await;
            }
        }
    } else if let Some(cookie_str) = req.headers().get("Cookie")
        .and_then(|v| v.to_str().ok())
    {
        if let Some(token) = cookie_str.split(';')
            .find(|part| part.trim().starts_with("valueskins_refresh="))
            .and_then(|part| part.split('=').nth(1))
            .map(|s| s.trim().to_string())
        {
            if let Ok(account_id) = session_mgr.get_account_id(&token).await {
                let _ = session_mgr.revoke_all_sessions(account_id).await;
            }
        }
    }

    let mut resp = HttpResponseBuilder::new(actix_web::http::StatusCode::OK);
    for cookie in clear_cookies(secure) {
        resp.cookie(cookie);
    }
    resp.json(serde_json::json!({"message": "Logged out"}))
}

// ── POST /auth/phone/request-otp ──

#[derive(Deserialize)]
pub struct PhoneOtpRequest {
    pub phone: String,
}

pub async fn request_otp(
    body: web::Json<PhoneOtpRequest>,
    phone_store: web::Data<PhoneAuthStore>,
) -> HttpResponse {
    let normalized = phone_store.normalize_phone(&body.phone);
    if normalized.len() < 8 || normalized.len() > 16 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid phone number"}));
    }

    match phone_store.generate_otp(&body.phone) {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"message": "OTP sent"})),
        Err(e) => HttpResponse::TooManyRequests().json(serde_json::json!({"error": e.to_string()})),
    }
}

// ── POST /auth/phone/verify-otp ──

#[derive(Deserialize)]
pub struct PhoneOtpVerifyRequest {
    pub phone: String,
    pub code: String,
}

pub async fn verify_otp(
    body: web::Json<PhoneOtpVerifyRequest>,
    phone_store: web::Data<PhoneAuthStore>,
) -> HttpResponse {
    match phone_store.verify_otp(&body.phone, &body.code) {
        Ok(true) => HttpResponse::Ok().json(serde_json::json!({"verified": true})),
        Ok(false) => HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid code"})),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({"error": e.to_string()})),
    }
}

// ── POST /auth/2fa/setup (requires auth) ──

pub async fn setup_2fa(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let account_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid account"})),
    };

    let already_enabled: bool = sqlx::query_scalar(
        "SELECT totp_enabled FROM accounts WHERE id = $1"
    )
    .bind(account_id)
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten()
    .unwrap_or(false);

    if already_enabled {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "2FA already enabled"}));
    }

    let email: String = sqlx::query_scalar("SELECT COALESCE(email, display_name) FROM accounts WHERE id = $1")
        .bind(account_id)
        .fetch_optional(pool.get_ref())
        .await
        .ok()
        .flatten()
        .unwrap_or_default();

    let setup = TwoFactorService::setup("ValueSkins", &email);

    let recovery_hashes: Vec<String> = setup.recovery_codes.iter()
        .map(|c| TwoFactorService::hash_recovery_code(c))
        .collect();

    let _ = sqlx::query(
        "UPDATE accounts SET totp_secret = $2, recovery_codes = $3 WHERE id = $1"
    )
    .bind(account_id)
    .bind(&setup.secret)
    .bind(&serde_json::to_value(&recovery_hashes).unwrap_or_default())
    .execute(pool.get_ref())
    .await;

    HttpResponse::Ok().json(serde_json::json!({
        "secret": setup.secret,
        "qr_code_url": setup.qr_code_url,
        "recovery_codes": setup.recovery_codes,
    }))
}

// ── POST /auth/2fa/verify-setup ──

#[derive(Deserialize)]
pub struct VerifyTwoFactorSetupRequest {
    pub totp_code: String,
}

pub async fn verify_setup_2fa(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<VerifyTwoFactorSetupRequest>,
) -> HttpResponse {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let account_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid account"})),
    };

    let secret: Option<String> = sqlx::query_scalar(
        "SELECT totp_secret FROM accounts WHERE id = $1"
    )
    .bind(account_id)
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten();

    match secret {
        Some(ref s) if TwoFactorService::verify_totp(s, &body.totp_code, 1) => {
            let _ = sqlx::query(
                "UPDATE accounts SET totp_enabled = TRUE WHERE id = $1"
            )
            .bind(account_id)
            .execute(pool.get_ref())
            .await;
            HttpResponse::Ok().json(serde_json::json!({"message": "2FA enabled successfully"}))
        }
        Some(_) => HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid code"})),
        None => HttpResponse::BadRequest().json(serde_json::json!({"error": "2FA not initialized"})),
    }
}

// ── POST /auth/2fa/disable ──

#[derive(Deserialize)]
pub struct DisableTwoFactorRequest {
    pub totp_code: Option<String>,
    pub recovery_code: Option<String>,
}

pub async fn disable_2fa(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<DisableTwoFactorRequest>,
) -> HttpResponse {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let account_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid account"})),
    };

    let row: Option<(String, Option<serde_json::Value>)> = sqlx::query_as(
        "SELECT totp_secret, recovery_codes FROM accounts WHERE id = $1 AND totp_enabled = TRUE"
    )
    .bind(account_id)
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten();

    let (secret, recovery_codes_json) = match row {
        Some(r) => r,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "2FA not enabled"})),
    };

    let valid = if let Some(ref code) = body.totp_code {
        TwoFactorService::verify_totp(&secret, code, 1)
    } else if let Some(ref code) = body.recovery_code {
        let codes: Vec<String> = recovery_codes_json
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();
        TwoFactorService::verify_recovery_code(code, &codes)
    } else {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Provide totp_code or recovery_code"}));
    };

    if !valid {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid code"}));
    }

    let _ = sqlx::query(
        "UPDATE accounts SET totp_enabled = FALSE, totp_secret = NULL, recovery_codes = NULL WHERE id = $1"
    )
    .bind(account_id)
    .execute(pool.get_ref())
    .await;

    HttpResponse::Ok().json(serde_json::json!({"message": "2FA disabled"}))
}

// ── POST /auth/email/verify ──

#[derive(Deserialize)]
pub struct EmailVerifyRequest {
    pub token: String,
}

pub async fn verify_email(
    body: web::Json<EmailVerifyRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let result = sqlx::query(
        "UPDATE accounts SET email_verified = TRUE, email_verification_token = NULL
         WHERE email_verification_token = $1 AND email_verified = FALSE"
    )
    .bind(&body.token)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => HttpResponse::Ok().json(serde_json::json!({"message": "Email verified"})),
        Ok(_) => HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid or expired token"})),
        Err(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"})),
    }
}

// ── POST /auth/email/resend ──

#[derive(Deserialize)]
pub struct ResendEmailVerifyRequest {
    pub email: String,
}

pub async fn resend_verification(
    body: web::Json<ResendEmailVerifyRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let email = body.email.trim().to_lowercase();
    if !email.contains('@') {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid email"}));
    }

    let token = rand::random::<u64>().to_string();
    let result = sqlx::query(
        "UPDATE accounts SET email_verification_token = $2 WHERE email = $1 AND email_verified = FALSE"
    )
    .bind(&email)
    .bind(&token)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!("[DEV] Verification email to {}: token={}", email, token);
            HttpResponse::Ok().json(serde_json::json!({"message": "Verification email sent"}))
        }
        Ok(_) => HttpResponse::BadRequest().json(serde_json::json!({"error": "Email not found or already verified"})),
        Err(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"})),
    }
}

// ── GET /auth/me ──

pub async fn get_me(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let account_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid account"})),
    };

    let svc = AccountService::new(pool.get_ref().clone());
    match svc.get_account_with_modules(account_id).await {
        Ok(account) => HttpResponse::Ok().json(account),
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({"error": "Account not found"})),
    }
}
