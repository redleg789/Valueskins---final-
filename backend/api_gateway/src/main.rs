mod handlers;
mod middleware;
mod routes;

use actix_cors::Cors;
use actix_governor::{Governor, GovernorConfigBuilder};
use actix_web::{web, App, HttpServer, HttpResponse, Responder, error::JsonPayloadError};
use dotenv::dotenv;
use shared::db::get_db_pool;
use shared::logging;
use sqlx::PgPool;
use std::env;
use std::time::Duration;

// Service Imports
use auth_service::token::TokenManager;
use auth_service::phone_auth::PhoneAuthStore;
use social_service::service::SocialService;
use analytics_service::service::AnalyticsService;
use recommendation_service::service::RecommendationService;

// Modular Monolith Handler Imports
use waitlist_service::handlers as waitlist_handlers;
use referral_service::handlers as referral_handlers;
use marketplace_service::handlers as marketplace_handlers;
use marketplace_service::interest_handlers as interest_handlers;
use brand_api::handlers as brand_handlers;
use notification_service::handlers as notification_handlers;
use notification_service::email::EmailService;
use communities_service::handlers as community_handlers;
use events_service::handlers as event_handlers;
use credential_service::handlers as credential_handlers;
use matching_service::handlers as matching_handlers;
use settings_service::handlers as settings_handlers;
use linkedin_service::handlers as linkedin_handlers;
use platform_service::handlers as platform_handlers;
use pricing_service::handlers as pricing_handlers;
use credit_service::handlers as credit_handlers;
use contract_service::handlers as contract_handlers;
use reputation_service::handlers as reputation_handlers;
use identity_service::handlers as identity_handlers;
use guardian_service::handlers as guardian_handlers;
use trust_service::handlers as trust_handlers;
use risk_engine::handlers as risk_handlers;
use verification_service::handlers as verification_handlers;
use moderation_service::handlers as moderation_handlers;

use account_service::handlers as account_handlers;

use crate::middleware::auth::JwtAuth;
use crate::middleware::rate_limit::{TieredRateLimiter, TierLimits};
use crate::middleware::maintenance::MaintenanceGuard;

fn is_strong_jwt_secret(secret: &str) -> bool {
    let weak_values = ["changeme", "secret", "default", "valueskins", "jwt_secret"];
    !(secret.len() < 32 || weak_values.iter().any(|w| secret.eq_ignore_ascii_case(w)))
}

fn validate_jwt_secret(secret: &str) {
    if !is_strong_jwt_secret(secret) {
        tracing::error!("JWT_SECRET failed security policy (min length 32, non-default)");
        std::process::exit(1);
    }
}

fn is_strong_shared_secret(secret: &str) -> bool {
    secret.len() >= 32
}

fn is_valid_origin_for_env(origin: &str, is_prod: bool) -> bool {
    let base_valid = origin.starts_with("https://") || origin.starts_with("http://localhost");
    if !base_valid {
        return false;
    }
    !(is_prod && origin.starts_with("http://localhost"))
}

fn validate_required_shared_secret(env_key: &str) {
    let value = match env::var(env_key) {
        Ok(v) => v,
        Err(_) => {
            tracing::error!(key = env_key, "Required secret not set");
            std::process::exit(1);
        }
    };
    if !is_strong_shared_secret(&value) {
        tracing::error!(key = env_key, "Required secret failed minimum strength policy");
        std::process::exit(1);
    }
}

fn validate_allowed_origins(origins: &str) {
    let is_prod = env::var("APP_ENV").map(|v| v == "production").unwrap_or(false);
    let parsed: Vec<&str> = origins
        .split(',')
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .collect();
    if parsed.is_empty() {
        tracing::error!("ALLOWED_ORIGINS must contain at least one origin");
        std::process::exit(1);
    }
    for origin in parsed {
        if !is_valid_origin_for_env(origin, is_prod) {
            tracing::error!(origin = origin, "Invalid origin in ALLOWED_ORIGINS for current environment");
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{is_strong_jwt_secret, is_strong_shared_secret, is_valid_origin_for_env};

    #[test]
    fn weak_secrets_are_rejected() {
        assert!(!is_strong_jwt_secret("secret"));
        assert!(!is_strong_jwt_secret("changeme"));
        assert!(!is_strong_jwt_secret("short"));
    }

    #[test]
    fn strong_secrets_are_accepted() {
        assert!(is_strong_jwt_secret("strong-production-jwt-secret-0123456789"));
    }

    #[test]
    fn shared_secret_policy() {
        assert!(!is_strong_shared_secret("short"));
        assert!(is_strong_shared_secret("minimum-32-chars-shared-secret-key!!"));
    }

    #[test]
    fn origin_policy_respects_environment() {
        assert!(is_valid_origin_for_env("https://valueskins.io", true));
        assert!(!is_valid_origin_for_env("http://localhost:3000", true));
        assert!(is_valid_origin_for_env("http://localhost:3000", false));
        assert!(!is_valid_origin_for_env("http://example.com", false));
    }
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "status": "ok", "service": "Valueskins API" }))
}

async fn health_ready(pool: web::Data<PgPool>) -> impl Responder {
    // Readiness check: verify database connectivity
    match sqlx::query("SELECT 1")
        .fetch_one(pool.get_ref())
        .await
    {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "ready",
            "service": "Valueskins API",
            "database": "connected"
        })),
        Err(e) => {
            tracing::error!("Readiness check failed: database connection error: {:?}", e);
            HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "status": "not_ready",
                "service": "Valueskins API",
                "database": "disconnected",
                "error": "database connection failed"
            }))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    // Initialize structured JSON logging with correlation ID support
    logging::init::init("api-gateway");

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set — refusing to start with default secret");
    validate_jwt_secret(&jwt_secret);
    validate_required_shared_secret("API_KEY_HMAC_SALT");
    validate_required_shared_secret("VERIFICATION_HMAC_SECRET");
    let allowed_origins = env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| {
            tracing::warn!("ALLOWED_ORIGINS not set — defaulting to production origins only (no localhost)");
            "https://valueskins.io,https://www.valueskins.io".to_string()
        });
    validate_allowed_origins(&allowed_origins);

    tracing::info!("Connecting to database...");
    let pool = match get_db_pool(&database_url).await {
        Ok(pool) => {
            tracing::info!("Database connected successfully.");
            pool
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to connect to database");
            std::process::exit(1);
        }
    };

    // Read replica support: if REPLICA_DATABASE_URL is set, analytics/reputation
    // queries route there. Otherwise falls back to primary (single-DB deploys).
    let replica_router = if let Ok(replica_url) = env::var("REPLICA_DATABASE_URL") {
        match shared::db::get_db_pool(&replica_url).await {
            Ok(replica_pool) => {
                tracing::info!("Read replica connected.");
                shared::read_replica::ReplicaRouter::with_replica(pool.clone(), replica_pool)
            }
            Err(e) => {
                tracing::warn!(error = %e, "Read replica connection failed — using primary for all queries");
                shared::read_replica::ReplicaRouter::primary_only(pool.clone())
            }
        }
    } else {
        shared::read_replica::ReplicaRouter::primary_only(pool.clone())
    };

    // Initialize circuit breaker
    let circuit_breaker = shared::circuit_breaker::CircuitBreaker::new("database");

    // Initialize production services
    let feature_flags = shared::feature_flags::FeatureFlagService::new(pool.clone());
    let refresh_tokens = shared::refresh_tokens::RefreshTokenService::new(pool.clone());
    let pii_audit = shared::pii_audit::PiiAuditLogger::new(pool.clone());
    let idempotency = shared::idempotency::IdempotencyService::new(pool.clone());
    let platform_cfg = std::sync::Arc::new(shared::platform_config::PlatformConfigService::new(pool.clone()));

    // Initialize Redis Cache
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let redis_cache = shared::cache::RedisCache::new(&redis_url).await.unwrap_or_else(|_| {
        tracing::warn!("Starting with disabled distributed cache");
        shared::cache::RedisCache::new_disabled()
    });

    // Initialize services
    let social_service = SocialService::new(pool.clone());
    let analytics_service = AnalyticsService::new(pool.clone());
    let recommendation_service = RecommendationService::new(pool.clone());

    // SMTP: fail-loud if credentials look like placeholders
    let smtp_host = env::var("SMTP_HOST").unwrap_or_default();
    let smtp_user = env::var("SMTP_USER").unwrap_or_default();
    let smtp_pass = env::var("SMTP_PASS").unwrap_or_default();
    let smtp_from = env::var("SMTP_FROM").unwrap_or_else(|_| "noreply@valueskins.io".to_string());
    let smtp_configured = !smtp_host.is_empty()
        && !smtp_host.contains("example.com")
        && !smtp_user.is_empty()
        && smtp_user != "user"
        && !smtp_pass.is_empty()
        && smtp_pass != "pass";

    if !smtp_configured {
        tracing::warn!("SMTP not configured — email notifications will be queued but NOT delivered. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable.");
    }

    let email_service = if smtp_configured {
        Some(EmailService::new(&smtp_host, &smtp_user, &smtp_pass, &smtp_from))
    } else {
        None
    };

    // Wrap in a shared Arc for both the worker and HTTP handlers
    let email_service_arc: std::sync::Arc<Option<EmailService>> = std::sync::Arc::new(email_service);

    // Rate limiter: 60 requests per minute per IP
    let governor_conf = GovernorConfigBuilder::default()
        .seconds_per_request(1)
        .burst_size(60)
        .finish()
        .unwrap();

    // Stricter limiter for public auth endpoints to reduce brute-force/abuse.
    let auth_governor_conf = GovernorConfigBuilder::default()
        .seconds_per_request(10)
        .burst_size(3)
        .finish()
        .unwrap();

    // Wrap in Data for sharing across request handlers
    let pool_data = web::Data::new(pool);
    let token_data = web::Data::new(TokenManager::new(&jwt_secret));
    let social_data = web::Data::new(social_service);
    let analytics_data = web::Data::new(analytics_service);
    let recommendation_data = web::Data::new(recommendation_service);
    let email_data = web::Data::from(email_service_arc.clone());
    let replica_data = web::Data::new(replica_router);
    let circuit_breaker_data = web::Data::new(circuit_breaker);
    let feature_flags_data = web::Data::new(feature_flags);
    let refresh_tokens_data = web::Data::new(refresh_tokens);
    let pii_audit_data = web::Data::new(pii_audit);
    let idempotency_data = web::Data::new(idempotency);
    let cache_data = web::Data::new(redis_cache);

    let phone_store = web::Data::new(PhoneAuthStore::new());

    // Clone jwt_secret for middleware creation inside HttpServer closure
    let jwt_secret_clone = jwt_secret.clone();

    // ── Background Workers ─────────────────────────────────────────
    // Outbox worker: polls event_outbox every 1s, dispatches to handlers
    let outbox_pool = pool_data.clone();
    tokio::spawn(async move {
        shared::workers::outbox_worker::start(
            outbox_pool.as_ref().clone(),
            std::time::Duration::from_secs(1),
        ).await;
    });

    // Cleanup worker: expires soft holds, offer rounds, cache entries, data retention every 60s
    let cleanup_pool = pool_data.clone();
    tokio::spawn(async move {
        shared::workers::cleanup_worker::start(
            cleanup_pool.as_ref().clone(),
            Duration::from_secs(60),
        ).await;
    });

    // Notification worker: dispatches pending notifications every 5s
    let notif_pool = pool_data.clone();
    tokio::spawn(async move {
        shared::workers::notification_worker::start_basic(
            notif_pool.as_ref().clone(),
            Duration::from_secs(5),
        ).await;
    });

    // Event lifecycle worker: archive windows, analytics rollups, report scheduling
    let event_lifecycle_pool = pool_data.clone();
    tokio::spawn(async move {
        shared::workers::event_lifecycle_worker::start(
            event_lifecycle_pool.as_ref().clone(),
            Duration::from_secs(300),
        ).await;
    });

    // Trust score recalculation: batch recalculate stale scores every 5 minutes
    let trust_pool = pool_data.clone();
    tokio::spawn(async move {
        let calculator = trust_service::calculator::TrustCalculator::new(
            trust_pool.as_ref().clone()
        );
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            match calculator.batch_recalculate(500).await {
                Ok(count) => {
                    if count > 0 {
                        tracing::info!(count, "Trust score batch recalculation completed");
                    }
                }
                Err(e) => tracing::error!(error = %e, "Trust score batch recalculation failed"),
            }
        }
    });

    // Risk scanning worker: run periodic detectors every 2 minutes
    let risk_pool = pool_data.clone();
    tokio::spawn(async move {
        let risk_engine = risk_engine::service::RiskEngineService::new(
            risk_pool.as_ref().clone()
        );
        let mut interval = tokio::time::interval(Duration::from_secs(120));
        loop {
            interval.tick().await;
            match risk_engine.run_periodic_scan().await {
                Ok(count) => {
                    if count > 0 {
                        tracing::info!(count, "Risk scan completed — events recorded");
                    }
                }
                Err(e) => tracing::error!(error = %e, "Periodic risk scan failed"),
            }
        }
    });

    // Age verification expiry worker: expire stale ADULT_ACTIVE states every 15 minutes
    let age_expiry_pool = pool_data.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(900));
        loop {
            interval.tick().await;
            let result: Result<i64, sqlx::Error> = sqlx::query_scalar(
                "WITH expired AS (
                    UPDATE user_verification_profiles
                    SET age_verification_state = 'AGE_EXPIRED',
                        updated_at = NOW()
                    WHERE age_verification_state = 'ADULT_ACTIVE'
                      AND age_verification_expires_at IS NOT NULL
                      AND age_verification_expires_at < NOW()
                    RETURNING user_id
                )
                SELECT COUNT(*) FROM expired"
            )
            .fetch_one(age_expiry_pool.as_ref())
            .await;
            if let Ok(count) = result {
                if count > 0 {
                    tracing::info!(count, "Age verification expirations processed");
                }
            }
        }
    });

    // Guardian invite expiry worker: expire stale invites every 5 minutes
    let guardian_expiry_pool = pool_data.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            let result: Result<i64, sqlx::Error> = sqlx::query_scalar(
                "WITH expired AS (
                    UPDATE guardian_relationships
                    SET relationship_state = 'INVITE_EXPIRED',
                        updated_at = NOW()
                    WHERE relationship_state = 'PENDING_INVITE'
                      AND invite_expires_at IS NOT NULL
                      AND invite_expires_at < NOW()
                    RETURNING id
                )
                SELECT COUNT(*) FROM expired"
            )
            .fetch_one(guardian_expiry_pool.as_ref())
            .await;
            if let Ok(count) = result {
                if count > 0 {
                    tracing::info!(count, "Guardian invite expirations processed");
                }
            }
        }
    });

    // Reputation service with Ed25519 signing key (must init before replica_router is moved)
    let reputation_signing_key = match env::var("PLATFORM_SIGNING_KEY_ED25519") {
        Ok(key) => key,
        Err(_) => {
            tracing::error!("PLATFORM_SIGNING_KEY_ED25519 not set — refusing to start (required for reputation passport signing)");
            std::process::exit(1);
        }
    };
    let reputation_svc = reputation_service::service::ReputationService::new(
        replica_data.write_pool().clone(),
        replica_data.read_pool().clone(),
        &reputation_signing_key,
    ).expect("Failed to initialize reputation service");
    let reputation_data = web::Data::new(std::sync::Arc::new(reputation_svc));

    tracing::info!("Starting Valueskins API at http://0.0.0.0:8080");

    HttpServer::new(move || {
        let origins_clone = allowed_origins.clone();
        let cors = Cors::default()
            .allowed_origin_fn(move |origin, _req_head| {
                let origins: Vec<&str> = origins_clone.split(',').collect();
                origins.iter().any(|o| origin.as_bytes() == o.as_bytes())
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Authorization", "Content-Type", "X-API-Key", "X-Correlation-ID"])
            // Required for httpOnly cookie sessions: browser will not send credentials
            // on cross-origin requests unless the server explicitly allows it.
            .supports_credentials()
            .max_age(3600);

        // Create JWT middleware (needs a new TokenManager per factory call)
        let jwt_auth = JwtAuth::new(TokenManager::new(&jwt_secret_clone));

        // Maintenance mode guard — checked before auth, returns 503 when enabled
        let maintenance = MaintenanceGuard::new(platform_cfg.clone());

        // Tiered rate limiter: applies different limits per user/API-key tier
        // after JWT is parsed (JWT middleware injects Claims into extensions).
        // Applied inside the App so it runs after auth resolves the tier.
        let tiered_limiter = TieredRateLimiter::new(TierLimits::default());

        App::new()
            .wrap(cors)
            .wrap(maintenance)
            .wrap(Governor::new(&governor_conf))
            .wrap(tiered_limiter)
            .wrap(crate::middleware::security_headers::security_headers())
            .wrap(crate::middleware::request_timeout::RequestTimeout::new(Duration::from_secs(30)))
            .wrap(logging::middleware::RequestLogger::new("api-gateway"))
            // Guardrail: reject oversized JSON payloads early to protect memory.
            .app_data(web::JsonConfig::default().limit(262_144).error_handler(|err, _req| {
                let status = match err {
                    JsonPayloadError::Overflow { .. } => actix_web::http::StatusCode::PAYLOAD_TOO_LARGE,
                    _ => actix_web::http::StatusCode::BAD_REQUEST,
                };
                actix_web::error::InternalError::from_response(
                    err,
                    HttpResponse::build(status).json(serde_json::json!({
                        "error": if status == actix_web::http::StatusCode::PAYLOAD_TOO_LARGE {
                            "Payload too large"
                        } else {
                            "Invalid JSON payload"
                        }
                    })),
                )
                .into()
            }))
            .app_data(web::PayloadConfig::new(1_048_576))
            .app_data(pool_data.clone())
            .app_data(token_data.clone())
            .app_data(social_data.clone())
            .app_data(analytics_data.clone())
            .app_data(recommendation_data.clone())
            .app_data(email_data.clone())
            .app_data(replica_data.clone())
            .app_data(circuit_breaker_data.clone())
            .app_data(feature_flags_data.clone())
            .app_data(refresh_tokens_data.clone())
            .app_data(pii_audit_data.clone())
            .app_data(idempotency_data.clone())
            .app_data(cache_data.clone())
            .app_data(web::Data::from(platform_cfg.clone()))
            .app_data(reputation_data.clone())
            .app_data(phone_store.clone())

            // === PUBLIC ROUTES (no auth required) ===
            .route("/health", web::get().to(health_check))
            .route("/health/live", web::get().to(health_check))
            .route("/health/ready", web::get().to(health_ready))
            // Prometheus metrics — bearer-token gated (internal scraper only)
            .route("/metrics", web::get().to(shared::observability::metrics::metrics_handler))

            .service(
                web::scope("/auth")
                    .wrap(Governor::new(&auth_governor_conf))
                    // Legacy Instagram-based auth
                    .route("/login", web::post().to(handlers::auth::login))
                    .route("/refresh", web::post().to(handlers::auth::refresh_token))
                    .route("/logout", web::post().to(handlers::auth::logout))
                    // Unified account-based auth
                    .route("/unified/signup", web::post().to(handlers::auth_ext::signup))
                    .route("/unified/login", web::post().to(handlers::auth_ext::login))
                    .route("/unified/refresh", web::post().to(handlers::auth_ext::refresh))
                    .route("/unified/logout", web::post().to(handlers::auth_ext::logout))
                    // Phone OTP
                    .route("/phone/request-otp", web::post().to(handlers::auth_ext::request_otp))
                    .route("/phone/verify-otp", web::post().to(handlers::auth_ext::verify_otp))
                    // Email verification
                    .route("/email/verify", web::post().to(handlers::auth_ext::verify_email))
                    .route("/email/resend", web::post().to(handlers::auth_ext::resend_verification))
                    // Dev login (bypasses OAuth — only in non-production)
                    .route("/dev/login", web::post().to(handlers::auth_ext::dev_login))

            )

            // Waitlist is public (pre-launch signups)
            .service(
                web::scope("/waitlist")
                    .route("/join", web::post().to(waitlist_handlers::join_waitlist))
                    .route("/position", web::get().to(waitlist_handlers::get_position))
                    .route("/stats", web::get().to(waitlist_handlers::get_stats))
            )

            // Public Brand API (uses API keys, not JWT)
            .service(
                web::scope("/api/v1")
                    .route("/verify/batch", web::post().to(brand_handlers::batch_verify))
                    .route("/verify/{persona_id}/{profession_id}", web::get().to(brand_handlers::verify_creator))
                    .route("/creators", web::get().to(brand_handlers::search_creators))
                    .route("/badge/{persona_id}/{profession_id}", web::get().to(brand_handlers::get_badge))
                    .route("/badge/{persona_id}/{profession_id}.svg", web::get().to(brand_handlers::get_badge_svg))
                    .route("/usage", web::get().to(brand_handlers::get_usage_stats))
                    .route("/professions", web::get().to(brand_handlers::list_professions))
                    // Creator data source API (mock for MVP, real API when Instagram/YouTube/TikTok/LinkedIn adopt)
                    .service(
                        web::scope("/creators")
                            .configure(routes::creators::configure)
                    )
                    // Opportunity/Campaign API (database-backed)
                    .service(
                        web::scope("/opportunities")
                            .configure(routes::opportunities::configure)
                    )
                    // Reputation API (calculated from deal history)
                    .service(
                        web::scope("/creators")
                            .configure(routes::reputation::configure)
                    )
            )

            // Referral code validation is public
            .service(
                web::scope("/referrals/validate")
                    .route("/{code}", web::get().to(referral_handlers::validate_code))
            )

            // Creator Interest Signups (public — for acquisition/traction)
            .service(
                web::scope("/interest")
                    .route("/signup", web::post().to(interest_handlers::create_interest_signup))
                    .route("/signup/{id}", web::get().to(interest_handlers::get_interest_signup))
            )

            // Public media kit view (no auth)
            .service(
                web::scope("/creators")
                    .route("/{slug}", web::get().to(handlers::mediakit::get_public_mediakit))
            )

            // === PROTECTED ROUTES (JWT required) ===
            .service(
                web::scope("")
                    .wrap(jwt_auth)

                    // Personas
                    .service(
                        web::scope("/personas")
                            .route("", web::get().to(handlers::persona::get_personas))
                            .route("/search", web::get().to(handlers::persona::search_valueskins))
                            .route("/me/profile", web::get().to(handlers::persona::get_my_profile))
                            .route("/me/profession", web::post().to(handlers::persona::set_my_profession))
                            .route("/{id}", web::get().to(handlers::persona::get_persona))
                            .route("/{id}/skins", web::get().to(handlers::persona::get_persona_skins))
                            .route("/{id}/trust", web::get().to(marketplace_handlers::get_trust_score))
                    )

                    // Public ValueSkin search and profile lookup for event tagging
                    .service(
                        web::scope("/valueskins")
                            .route("/search", web::get().to(handlers::persona::search_valueskins))
                            .route("/profile/{id}", web::get().to(handlers::persona::get_persona))
                    )

                    // Referrals (authenticated)
                    .service(
                        web::scope("/referrals")
                            .route("/codes", web::post().to(referral_handlers::create_code))
                            .route("/record", web::post().to(referral_handlers::record_referral))
                            .route("/stats/{id}", web::get().to(referral_handlers::get_stats))
                            .route("/leaderboard", web::get().to(referral_handlers::get_leaderboard))
                    )

                    // Marketplace (authenticated — requires ValueSkin)
                    .service(
                        web::scope("/marketplace")
                            .route("/professions", web::get().to(marketplace_handlers::list_professions))
                            .route("/opportunities", web::get().to(marketplace_handlers::list_opportunities))
                            .route("/opportunities", web::post().to(marketplace_handlers::create_opportunity))
                            .route("/opportunities/{id}", web::get().to(marketplace_handlers::get_opportunity))
                            .route("/applications", web::post().to(marketplace_handlers::apply_to_opportunity))
                            .route("/applications/mine", web::get().to(marketplace_handlers::get_my_applications))
                            .route("/stats", web::get().to(marketplace_handlers::get_stats))
                            // Discovery throttle: brand scans a creator profile
                            .route("/scan/{persona_id}", web::post().to(marketplace_handlers::scan_creator))
                    )

                    // Deal Rooms — private negotiation between brand and creator
                    .service(
                        web::scope("/deal-rooms")
                            .route("", web::post().to(marketplace_handlers::open_deal_room))
                            .route("", web::get().to(marketplace_handlers::list_deal_rooms))
                            .route("/{id}/offers", web::post().to(marketplace_handlers::make_offer))
                            .route("/{id}/soft-hold", web::post().to(marketplace_handlers::create_soft_hold))
                            .route("/{id}/checklist", web::get().to(marketplace_handlers::get_checklist))
                            .route("/{id}/escrow", web::post().to(marketplace_handlers::create_escrow_stages))
                            .route("/{id}/repeat", web::post().to(marketplace_handlers::repeat_collab))
                            .route("/{id}/messages", web::post().to(handlers::messages::post_message))
                            .route("/{id}/messages", web::get().to(handlers::messages::get_messages))
                            .route("/{id}/disputes", web::post().to(marketplace_handlers::create_dispute))
                            .route("/{id}/disputes", web::get().to(marketplace_handlers::list_deal_room_disputes))
                            .route("/{id}/payment-preferences", web::post().to(marketplace_handlers::save_payment_preferences))
                            .route("/{id}/payment-preferences", web::get().to(marketplace_handlers::get_payment_preferences))
                            .route("/{id}/finalize", web::post().to(marketplace_handlers::finalize_deal))
                            .route("/{id}/status", web::get().to(marketplace_handlers::get_deal_room_status))
                    )

                    // Offer round responses
                    .service(
                        web::scope("/offers")
                            .route("/{id}/respond", web::post().to(marketplace_handlers::respond_to_offer))
                    )

                    // Creator self-management
                    .service(
                        web::scope("/creators/me")
                            .route("/price-band", web::post().to(marketplace_handlers::set_price_band))
                            .route("/auto-escalation", web::post().to(marketplace_handlers::set_auto_escalation))
                            .route("/energy", web::post().to(marketplace_handlers::set_energy_state))
                            .route("/deliverables", web::post().to(marketplace_handlers::upload_deliverable))
                            .route("/calendar", web::post().to(marketplace_handlers::set_calendar_slot))
                            .route("/barter", web::get().to(marketplace_handlers::get_barter_preference))
                            .route("/barter", web::post().to(marketplace_handlers::set_barter_preference))
                            .route("/valueskins/{id}/hide", web::post().to(marketplace_handlers::hide_valueskin))
                            .route("/valueskins/{id}/unhide", web::post().to(marketplace_handlers::unhide_valueskin))
                            .route("/valueskins/{id}", web::delete().to(marketplace_handlers::delete_valueskin))
                    )

                    // Barter discovery (for brands)
                    .service(
                        web::scope("/creators")
                            .route("/barter-willing", web::get().to(marketplace_handlers::list_barter_willing_creators))
                    )

                    // Testimonials
                    .service(
                        web::scope("/testimonials")
                            .route("", web::post().to(marketplace_handlers::submit_testimonial))
                    )

                    // Communities
                    .service(
                        web::scope("/communities")
                            .route("", web::post().to(community_handlers::create_community))
                            .route("", web::get().to(community_handlers::list_communities))
                            .route("/{id}", web::get().to(community_handlers::get_community))
                            .route("/{id}/join", web::post().to(community_handlers::join_community))
                            .route("/{id}/leave", web::post().to(community_handlers::leave_community))
                            .route("/{id}/members", web::get().to(community_handlers::list_members))
                            .route("/{id}/posts", web::post().to(community_handlers::create_post))
                            .route("/{id}/posts", web::get().to(community_handlers::list_posts))
                            .route("/posts/{id}/like", web::post().to(community_handlers::like_post))
                            .route("/posts/{id}/unlike", web::post().to(community_handlers::unlike_post))
                            .route("/admin/pricing", web::post().to(community_handlers::set_pricing))
                            .route("/admin/pricing", web::get().to(community_handlers::get_pricing))
                    )

                    // Events
                    .service(
                        web::scope("/events")
                            .route("", web::post().to(event_handlers::create_event))
                            .route("/{id}", web::get().to(event_handlers::get_event))
                            .route("/{id}/register", web::post().to(event_handlers::register_event))
                            .route("/{id}/register", web::delete().to(event_handlers::unregister_event))
                            .route("/{id}/interactions", web::post().to(event_handlers::record_interaction))
                            .route("/{id}/tags", web::get().to(event_handlers::list_event_tags))
                            .route("/{id}/tags", web::post().to(event_handlers::create_event_tag))
                            .route("/{id}/tags/{tag_id}", web::delete().to(event_handlers::delete_event_tag))
                            .route("/{id}/tags/{tag_id}/approve", web::post().to(event_handlers::approve_event_tag))
                            .route("/{id}/tags/{tag_id}/reject", web::post().to(event_handlers::reject_event_tag))
                    )

                    // Explorer
                    .service(
                        web::scope("/explorer")
                            .route("/home", web::get().to(event_handlers::get_explorer_home))
                            .route("/location", web::put().to(event_handlers::update_location))
                    )

                    // Credentials & Identity Verification
                    .service(
                        web::scope("/credentials")
                            .route("", web::post().to(credential_handlers::link_credential))
                            .route("", web::get().to(credential_handlers::list_credentials))
                            .route("/profile/{user_id}", web::get().to(credential_handlers::get_verification_profile))
                    )
                    .service(
                        web::scope("/identity")
                            .route("", web::post().to(credential_handlers::link_identity))
                            .route("", web::get().to(credential_handlers::list_identity_proofs))
                    )

                    // ValuSkin-Based Matching — creators and brands match ONLY on shared profession
                    .service(
                        web::scope("/matching")
                            .route("/creators", web::get().to(matching_handlers::discover_creators))
                            .route("/opportunities", web::get().to(matching_handlers::discover_opportunities))
                            .route("/persona/{persona_id}/opportunities", web::get().to(matching_handlers::get_persona_matched_opportunities))
                            .route("/opportunities/{id}/requirements", web::post().to(matching_handlers::set_requirements))
                            .route("/opportunities/{id}/requirements", web::get().to(matching_handlers::get_requirements))
                            .route("/audit", web::get().to(matching_handlers::get_audit_log))
                            // Deal Suggestions (AI-ranked proactive matches)
                            .route("/suggestions", web::get().to(matching_handlers::get_suggestions))
                            .route("/suggestions/{id}/action", web::post().to(matching_handlers::act_on_suggestion))
                            .route("/opportunities/{id}/generate-suggestions", web::post().to(matching_handlers::generate_suggestions))
                    )

                    // Deal Room Chat
                    .service(
                        web::scope("/deal-rooms")
                            .route("/{deal_room_id}/chat", web::get().to(matching_handlers::get_chat_history))
                            .route("/{deal_room_id}/chat", web::post().to(matching_handlers::send_message))
                    )

                    // Pricing Benchmarks — market authority for creator rates
                    .service(
                        web::scope("/pricing")
                            .route("/benchmark", web::get().to(pricing_handlers::get_benchmark))
                            .route("/my-worth", web::get().to(pricing_handlers::get_personal_valuation))
                            .route("/recompute", web::post().to(pricing_handlers::recompute_benchmarks))
                    )

                    // Creator Credit Lines — deterministic scoring, advance draws
                    .service(
                        web::scope("/credit")
                            .route("/apply", web::post().to(credit_handlers::apply_credit))
                            .route("/status", web::get().to(credit_handlers::get_status))
                            .route("/score", web::get().to(credit_handlers::get_score))
                            .route("/advance", web::post().to(credit_handlers::draw_advance))
                            .route("/repay/{advance_id}", web::post().to(credit_handlers::repay_advance))
                            .route("/advances", web::get().to(credit_handlers::list_advances))
                    )

                    // Contracts — auto-generation, e-signature, SHA-256 tamper evidence
                    .service(
                        web::scope("/contracts")
                            .route("/generate", web::post().to(contract_handlers::generate_contract))
                            .route("/templates", web::get().to(contract_handlers::list_templates))
                            .route("/{id}", web::get().to(contract_handlers::get_contract))
                            .route("/{id}/sign", web::post().to(contract_handlers::sign_contract))
                            .route("/{id}/revisions", web::post().to(contract_handlers::request_revision))
                            .route("/deal-room/{deal_room_id}", web::get().to(contract_handlers::get_contract_by_deal_room))
                    )

                    // Reputation Passports — Ed25519-signed, verifiable by brands
                    .service(
                        web::scope("/reputation")
                            .route("/export", web::post().to(reputation_handlers::generate_export))
                            .route("/verify", web::get().to(reputation_handlers::verify_export))
                            .route("/exports", web::get().to(reputation_handlers::list_exports))
                            .route("/public-key", web::get().to(reputation_handlers::get_public_key))
                    )

                    // User Settings (barter preference, energy, price band, etc.)
                    .service(
                        web::scope("/settings")
                            .route("", web::get().to(settings_handlers::get_settings))
                            .route("", web::patch().to(settings_handlers::update_settings))
                    )

                    // LinkedIn — profile linking, connections, recommendations, community invitations
                    .service(
                        web::scope("/linkedin")
                            .route("", web::post().to(linkedin_handlers::link_profile))
                            .route("", web::get().to(linkedin_handlers::get_profile))
                            .route("/visibility", web::post().to(linkedin_handlers::set_visibility))
                            .route("/unlink", web::post().to(linkedin_handlers::unlink_profile))
                            .route("/connections", web::get().to(linkedin_handlers::list_connections))
                            .route("/connections/request", web::post().to(linkedin_handlers::send_connection_request))
                            .route("/connections/respond", web::post().to(linkedin_handlers::respond_to_connection))
                            .route("/connections/shared", web::get().to(linkedin_handlers::list_connections_with_shared_skins))
                            .route("/connections/pending", web::get().to(linkedin_handlers::list_pending_requests))
                            .route("/recommendations", web::post().to(linkedin_handlers::give_recommendation))
                            .route("/recommendations/{user_id}", web::get().to(linkedin_handlers::get_recommendations))
                            .route("/invitations", web::post().to(linkedin_handlers::invite_to_community))
                            .route("/invitations", web::get().to(linkedin_handlers::list_pending_invitations))
                            .route("/invitations/{id}/respond", web::post().to(linkedin_handlers::respond_to_invitation))
                    )

                    // Platform Settings — C-Suite advantage + campaign gating configuration
                    .service(
                        web::scope("/admin/platform")
                            .route("/{platform_id}/csuite-settings", web::get().to(platform_handlers::get_csuite_settings))
                            .route("/{platform_id}/csuite-settings", web::post().to(platform_handlers::update_csuite_settings))
                    )

                    // Persona Titles — C-Suite title management
                    .service(
                        web::scope("/personas/{persona_id}/titles")
                            .route("", web::post().to(platform_handlers::add_title))
                            .route("", web::get().to(platform_handlers::list_titles))
                            .route("/{title_id}/verify", web::post().to(platform_handlers::verify_title))
                            .route("/{title_id}", web::delete().to(platform_handlers::remove_title))
                    )

                    // Title Audit Log
                    .service(
                        web::scope("/personas/{persona_id}/titles/audit")
                            .route("", web::get().to(platform_handlers::get_title_audit_log))
                    )

                    // Brand management (authenticated brand users)
                    .service(
                        web::scope("/brands")
                            .route("/dashboard", web::get().to(handlers::brand::get_brand_dashboard))
                            .route("/discover", web::get().to(handlers::brand::discover_creators))
                            .route("/opportunities/{id}/applications", web::get().to(marketplace_handlers::get_opportunity_applications))
                            .route("/applications/accept", web::post().to(marketplace_handlers::accept_application))
                            .route("/deals/complete", web::post().to(marketplace_handlers::complete_deal))
                            // Brand verification (self-serve)
                            .route("/verify", web::post().to(marketplace_handlers::submit_brand_verification))
                            .route("/verify", web::get().to(marketplace_handlers::get_brand_verification_status))
                    )

                    // GDPR Data Deletion (user self-service)
                    .service(
                        web::scope("/users/me/data-deletion")
                            .route("", web::post().to(marketplace_handlers::request_data_deletion))
                            .route("", web::get().to(marketplace_handlers::get_deletion_status))
                            .route("", web::delete().to(marketplace_handlers::cancel_data_deletion))
                    )

                    // Creator completeness
                    .service(
                        web::scope("/creators/me/completeness")
                            .route("", web::get().to(marketplace_handlers::get_my_completeness))
                    )
                    .service(
                        web::scope("/creators/{user_id}/completeness")
                            .route("", web::get().to(marketplace_handlers::get_creator_completeness))
                    )

                    // Payout history (creator)
                    .service(
                        web::scope("/creators/me/payouts")
                            .route("", web::get().to(marketplace_handlers::get_my_payouts))
                    )

                    // Admin: brand verification, payouts, interest signups, leaderboard, stats, flags
                    .service(
                        web::scope("/admin")
                            .route("/brands/verify", web::get().to(marketplace_handlers::admin_list_brand_verifications))
                            .route("/brands/{user_id}/verify", web::post().to(marketplace_handlers::admin_review_brand_verification))
                            .route("/payouts", web::post().to(marketplace_handlers::create_payout))
                            .route("/payouts/reconciliation", web::get().to(marketplace_handlers::admin_payout_reconciliation))
                            // Creator Interest Signup Management
                            .route("/interest/signups", web::get().to(interest_handlers::list_interest_signups))
                            .route("/interest/stats", web::get().to(interest_handlers::get_interest_stats))
                            .route("/interest/signups/{id}/contact", web::post().to(interest_handlers::contact_interest_signup))
                            .route("/interest/signups/{id}/convert", web::post().to(interest_handlers::convert_interest_signup))
                            .route("/interest/signups/{id}/reject", web::post().to(interest_handlers::reject_interest_signup))
                            // Leaderboard (materialized view)
                            .route("/leaderboard", web::get().to(handlers::admin::get_leaderboard))
                            // Platform stats
                            .route("/stats", web::get().to(handlers::admin::get_platform_stats))
                            // Feature flags management
                            .route("/flags", web::get().to(handlers::admin::list_feature_flags))
                            .route("/flags/{name}", web::patch().to(handlers::admin::update_feature_flag))
                            .route("/flags/{name}/kill", web::post().to(handlers::admin::kill_feature_flag))
                            // Users management
                            .route("/users", web::get().to(handlers::admin::list_users))
                            .route("/users/{id}", web::get().to(handlers::admin::get_user))
                            .route("/users/{id}/deactivate", web::post().to(handlers::admin::deactivate_user))
                            // GDPR requests
                            .route("/gdpr/requests", web::get().to(handlers::admin::list_gdpr_requests))
                            .route("/gdpr/requests/{id}/process", web::post().to(handlers::admin::process_gdpr_request))
                            // Disputes
                            .route("/disputes", web::get().to(handlers::admin::list_disputes))
                            .route("/disputes/{id}/resolve", web::post().to(handlers::admin::resolve_dispute))
                            // PII audit log
                            .route("/pii-audit/{user_id}", web::get().to(handlers::admin::get_pii_audit_log))
                            // API Keys
                            .route("/api-keys", web::get().to(handlers::admin::list_api_keys))
                            // Platform config
                            .route("/config", web::get().to(handlers::admin::get_platform_config))
                            .route("/config", web::post().to(handlers::admin::update_platform_config))
                            .route("/events/categories", web::get().to(handlers::admin::get_event_category_performance))
                            .route("/events/cities", web::get().to(handlers::admin::get_event_city_performance))
                            .route("/events/hosts", web::get().to(handlers::admin::get_event_host_performance))
                            .route("/events/network", web::get().to(handlers::admin::get_event_network_map))
                            .route("/events/reports", web::get().to(handlers::admin::list_event_report_runs))
                            .route("/events/reports/{id}", web::get().to(handlers::admin::get_event_report_detail))
                    )

                    // Contracts / Deal Rooms (user's view)
                    .route("/contracts", web::get().to(handlers::admin::list_my_contracts))

                    // Equity system
                    .service(
                        web::scope("/equity")
                            .route("/me", web::get().to(handlers::equity::get_my_equity))
                            .route("/dividends", web::get().to(handlers::equity::get_dividend_history))
                    )

                    // Insurance / Protection Fund
                    .service(
                        web::scope("/insurance")
                            .route("/me", web::get().to(handlers::insurance::get_my_insurance))
                            .route("/pool", web::get().to(handlers::insurance::get_protection_pool))
                            .route("/claims", web::post().to(handlers::insurance::file_claim))
                    )

                    // Creator Collectives
                    .service(
                        web::scope("/collectives")
                            .route("", web::get().to(handlers::collective::list_collectives))
                            .route("/{id}", web::get().to(handlers::collective::get_collective))
                    )

                    // Market Rates (public within auth scope)
                    .service(
                        web::scope("/market-rates")
                            .route("", web::get().to(handlers::collective::get_market_rates))
                    )

                    // Media Kit
                    .service(
                        web::scope("/mediakit")
                            .route("/me", web::get().to(handlers::mediakit::get_my_mediakit))
                            .route("/me", web::patch().to(handlers::mediakit::update_mediakit))
                    )

                    // Verification & Trust (legacy)
                    .service(
                        web::scope("/verification")
                            .route("/me", web::get().to(handlers::verification::get_my_verification))
                    )

                    // ── Identity Service (Age Verification, Documents, KYC) ──
                    .service(
                        web::scope("/identity/v2")
                            .route("/age/dob", web::post().to(identity_handlers::submit_dob))
                            .route("/age/status", web::get().to(identity_handlers::get_age_status))
                            .route("/documents/upload", web::post().to(identity_handlers::upload_document))
                            .route("/documents/{id}", web::get().to(identity_handlers::get_document_status))
                            .route("/kyc/status", web::get().to(identity_handlers::get_kyc_status))
                            .route("/kyc/init", web::post().to(identity_handlers::init_kyc))
                    )

                    // ── Guardian Service (Parental/Guardian Controls) ──
                    .service(
                        web::scope("/guardian")
                            .route("/invite", web::post().to(guardian_handlers::invite_guardian))
                            .route("/accept-invite", web::post().to(guardian_handlers::accept_invite))
                            .route("/relationships", web::get().to(guardian_handlers::get_relationships))
                            .route("/dashboard", web::get().to(guardian_handlers::get_dashboard))
                            .route("/relationships/{id}/consent/{consent_doc_id}/{guardian_doc_id}", web::post().to(guardian_handlers::complete_consent))
                            .route("/relationships/{id}/permissions", web::get().to(guardian_handlers::get_permissions))
                            .route("/relationships/{id}/permissions", web::put().to(guardian_handlers::update_permissions))
                            .route("/relationships/{id}/revoke", web::post().to(guardian_handlers::revoke_consent))
                    )

                    // ── Trust Service (Scoring, Badges, Profile) ──
                    .service(
                        web::scope("/trust")
                            .route("/score", web::get().to(trust_handlers::get_trust_score))
                            .route("/events", web::post().to(trust_handlers::record_event))
                            .route("/tiers", web::get().to(trust_handlers::get_tiers))
                            .route("/me", web::get().to(trust_handlers::get_my_trust_profile))
                    )
                    // Shortcut: full trust profile at /me/trust
                    .route("/me/trust", web::get().to(trust_handlers::get_my_trust_profile))

                    // ── Risk Engine (Fraud Detection & Risk Scoring) ──
                    .service(
                        web::scope("/risk")
                            .route("/assess", web::get().to(risk_handlers::get_risk_assessment))
                            .route("/events", web::post().to(risk_handlers::record_risk_event))
                            .route("/scan", web::post().to(risk_handlers::run_scan))
                    )

                    // ── Verification Service (Company, Enterprise, Employee) ──
                    .service(
                        web::scope("/enterprise")
                            .route("/companies", web::post().to(verification_handlers::create_company))
                            .route("/companies/{id}/status", web::get().to(verification_handlers::get_company_status))
                            .route("/companies/{id}/domain/initiate", web::post().to(verification_handlers::initiate_domain_verification))
                            .route("/companies/{id}/domain/verify", web::post().to(verification_handlers::verify_domain))
                            .route("/employees/verify", web::post().to(verification_handlers::initiate_employee_verification))
                            .route("/employees/{id}/confirm", web::post().to(verification_handlers::complete_employee_verification))
                    )

                    // ── Moderation Service (Reports, Appeals, Queue) ──
                    .service(
                        web::scope("/moderation")
                            .route("/reports", web::post().to(moderation_handlers::create_report))
                            .route("/reports/mine", web::get().to(moderation_handlers::get_own_reports))
                            .route("/reports/{id}/appeal", web::post().to(moderation_handlers::file_appeal))
                    )
                    .service(
                        web::scope("/admin/moderation")
                            .route("/queue", web::get().to(moderation_handlers::get_queue))
                            .route("/queue/stats", web::get().to(moderation_handlers::get_queue_stats))
                            .route("/queue/{id}", web::get().to(moderation_handlers::get_queue_item))
                            .route("/queue/{id}/assign", web::post().to(moderation_handlers::assign_moderator))
                            .route("/queue/{id}/action", web::post().to(moderation_handlers::take_action))
                            .route("/queue/{id}/notes", web::post().to(moderation_handlers::add_notes))
                            .route("/queue/{id}/escalate", web::post().to(moderation_handlers::escalate))
                            .route("/appeals/{id}/review", web::post().to(moderation_handlers::review_appeal))
                            .route("/audit-log", web::get().to(moderation_handlers::get_audit_log))
                            .route("/users/{id}/restrictions", web::get().to(moderation_handlers::get_user_restrictions))
                            .route("/users/{id}/history", web::get().to(moderation_handlers::get_user_moderation_history))
                    )

                    // Account management (unified system)
                    .service(
                        web::scope("/account")
                            .route("/me", web::get().to(account_handlers::get_me))
                            .route("/me", web::patch().to(account_handlers::update_me))
                            .route("/modules", web::get().to(account_handlers::list_modules))
                            .route("/modules/activate", web::post().to(account_handlers::activate_module))
                            .route("/modules/deactivate", web::post().to(account_handlers::deactivate_module))
                            .route("/preferences", web::post().to(account_handlers::update_preferences))
                            .route("/permissions", web::get().to(account_handlers::get_permissions))
                            .route("/sessions", web::get().to(account_handlers::list_sessions))
                            .route("/sessions/{id}", web::delete().to(account_handlers::revoke_session))
                    )
                    // 2FA (requires auth)
                    .service(
                        web::scope("/account")
                            .route("/2fa/setup", web::post().to(handlers::auth_ext::setup_2fa))
                            .route("/2fa/verify-setup", web::post().to(handlers::auth_ext::verify_setup_2fa))
                            .route("/2fa/disable", web::post().to(handlers::auth_ext::disable_2fa))
                    )
                    // Authenticated user info
                    .route("/auth/me", web::get().to(handlers::auth_ext::get_me))

                    // Notifications
                    .service(
                        web::scope("/notifications")
                            .route("/send", web::post().to(notification_handlers::send_notification))
                    )

                    // Social
                    .service(
                        web::scope("/social")
                            .route("/posts", web::post().to(handlers::social::create_post))
                    )

                    // AI Scoring
                    .service(
                        web::scope("/ai")
                            .route("/score", web::post().to(handlers::ai::get_score))
                    )

                    // Analytics
                    .service(
                        web::scope("/analytics")
                            .route("/events", web::post().to(handlers::analytics::log_event))
                    )

                    // Recommendations
                    .service(
                        web::scope("/recommendations")
                            .route("/brands", web::get().to(handlers::recommendation::get_matching_brands))
                    )
            )
    })
    .bind(("0.0.0.0", 8080))?
    // Graceful shutdown: finish in-flight requests before stopping.
    // Without this, Kubernetes sends SIGTERM and active deal completions
    // are aborted mid-transaction, leaving inconsistent state.
    .shutdown_timeout(30) // 30 seconds to drain active connections
    .run()
    .await
}
