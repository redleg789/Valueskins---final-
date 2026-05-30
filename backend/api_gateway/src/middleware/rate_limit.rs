//! Rate Limiting Middleware
//!
//! Two-layer rate limiting:
//! 1. IP-based global limiter (actix-governor, already wired in main.rs)
//! 2. Tiered per-user/per-API-key limiter (this module) — enforces different
//!    limits based on the authenticated user's subscription tier.
//!
//! Tier limits (requests per minute):
//!   free:       100
//!   basic:     1000
//!   pro:      10000
//!   enterprise: unlimited (u32::MAX)
//!
//! How tier is resolved (in priority order):
//!   1. X-API-Key header → look up key in api_keys table, use that tier
//!   2. JWT claims.tier field → use declared tier
//!   3. Default: "free"
//!
//! ## Multi-Pod Scaling Note
//!
//! Current implementation uses in-memory `Arc<Mutex<HashMap>>`. This is per-process.
//! In a multi-pod Kubernetes deployment, each pod tracks independently.
//! Effective limit = N_pods × configured_limit.
//!
//! **Migration path for Redis-backed rate limiting:**
//! 1. Add `redis` to shared/Cargo.toml (already a dependency)
//! 2. Replace `ClientMap` with Redis INCR + EXPIRE (sliding window)
//! 3. Use `shared::cache::RedisCache` which already handles connection pooling
//! 4. Fall back to in-memory if Redis is unavailable (graceful degradation)
//!
//! For most deployments (< 10 pods), the current approach is sufficient because
//! the IP-level governor (actix-governor) provides a hard ceiling regardless.

use actix_web::{
    dev::{ServiceRequest, ServiceResponse, Transform, Service},
    Error, HttpResponse, body::EitherBody,
    HttpMessage,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::future::{Ready, Future};
use std::pin::Pin;
use std::task::{Context, Poll};
use auth_service::token::Claims;

/// Limits (requests per minute) for each tier.
#[derive(Clone, Copy, Debug)]
pub struct TierLimits {
    pub free: u32,
    pub basic: u32,
    pub pro: u32,
    pub enterprise: u32,
}

impl Default for TierLimits {
    fn default() -> Self {
        Self {
            free: 100,
            basic: 1_000,
            pro: 10_000,
            enterprise: u32::MAX,
        }
    }
}

impl TierLimits {
    pub fn limit_for(&self, tier: &str) -> u32 {
        match tier {
            "basic"      => self.basic,
            "pro"        => self.pro,
            "enterprise" => self.enterprise,
            _            => self.free,  // default: free
        }
    }
}

fn normalize_tier(tier: &str) -> &str {
    match tier {
        "free" | "basic" | "pro" | "enterprise" => tier,
        _ => "free",
    }
}

fn safe_prefix(input: &str, max_chars: usize) -> String {
    input.chars().take(max_chars).collect()
}

/// Per-key sliding-window state: (request count, window start time)
type ClientMap = Arc<Mutex<HashMap<String, (u32, Instant)>>>;
const MAX_RATE_KEYS: usize = 50_000;
const RATE_KEYS_TARGET_AFTER_EVICT: usize = 45_000;

fn evict_rate_keys(map: &mut HashMap<String, (u32, Instant)>, now: Instant, window: Duration) {
    if map.len() <= MAX_RATE_KEYS {
        return;
    }

    map.retain(|_, (_, start)| now.duration_since(*start) < window);
    if map.len() <= MAX_RATE_KEYS {
        return;
    }

    let drop_count = map.len().saturating_sub(RATE_KEYS_TARGET_AFTER_EVICT);
    if drop_count == 0 {
        return;
    }

    let mut oldest: Vec<(String, Instant)> = map
        .iter()
        .map(|(k, (_, start))| (k.clone(), *start))
        .collect();
    oldest.sort_by_key(|(_, started_at)| *started_at);

    for (key, _) in oldest.into_iter().take(drop_count) {
        map.remove(&key);
    }
}

/// Tiered rate limiter middleware factory.
pub struct TieredRateLimiter {
    limits: TierLimits,
    window: Duration,
    clients: ClientMap,
}

impl TieredRateLimiter {
    pub fn new(limits: TierLimits) -> Self {
        Self {
            limits,
            window: Duration::from_secs(60),
            clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Default for TieredRateLimiter {
    fn default() -> Self {
        Self::new(TierLimits::default())
    }
}

impl<S, B> Transform<S, ServiceRequest> for TieredRateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = TieredRateLimiterMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        std::future::ready(Ok(TieredRateLimiterMiddleware {
            service: Arc::new(service),
            limits: self.limits,
            window: self.window,
            clients: self.clients.clone(),
        }))
    }
}

pub struct TieredRateLimiterMiddleware<S> {
    service: Arc<S>,
    limits: TierLimits,
    window: Duration,
    clients: ClientMap,
}

impl<S, B> Service<ServiceRequest> for TieredRateLimiterMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let clients = self.clients.clone();
        let limits = self.limits;
        let window = self.window;

        Box::pin(async move {
            // ── Determine tier + rate limit key ─────────────────────────────
            // Key format: "tier:identifier" — separates free users by IP so
            // one shared-IP network doesn't get the enterprise limit.
            let (tier, rate_key) = resolve_tier_and_key(&req);
            let limit = limits.limit_for(&tier);

            // ── Sliding window check ─────────────────────────────────────────
            let (exceeded, current_count) = {
                let mut map = match clients.lock() {
                    Ok(guard) => guard,
                    Err(poisoned) => {
                        tracing::error!("TieredRateLimiter mutex poisoned — recovering");
                        poisoned.into_inner()
                    }
                };
                let now = Instant::now();
                evict_rate_keys(&mut map, now, window);
                let entry = map.entry(rate_key.clone()).or_insert((0, now));

                if now.duration_since(entry.1) >= window {
                    // Window expired — reset
                    *entry = (0, now);
                }

                entry.0 += 1;
                let count = entry.0;
                (count > limit, count)
            };

            if exceeded {
                let response = HttpResponse::TooManyRequests()
                    .insert_header(("X-RateLimit-Limit", limit.to_string()))
                    .insert_header(("X-RateLimit-Remaining", "0"))
                    .insert_header(("X-RateLimit-Tier", tier.as_str()))
                    .insert_header(("Retry-After", "60"))
                    .json(serde_json::json!({
                        "error": "Rate limit exceeded",
                        "tier": tier,
                        "limit": limit,
                        "retry_after_seconds": 60
                    }));
                return Ok(req.into_response(response).map_into_right_body());
            }

            // Pass rate limit headers on successful requests
            let remaining = limit.saturating_sub(current_count);
            let mut res = service.call(req).await?;
            res.headers_mut().insert(
                actix_web::http::header::HeaderName::from_static("x-ratelimit-limit"),
                actix_web::http::header::HeaderValue::from_str(&limit.to_string()).unwrap_or_else(|_| actix_web::http::header::HeaderValue::from_static("0")),
            );
            res.headers_mut().insert(
                actix_web::http::header::HeaderName::from_static("x-ratelimit-remaining"),
                actix_web::http::header::HeaderValue::from_str(&remaining.to_string()).unwrap_or_else(|_| actix_web::http::header::HeaderValue::from_static("0")),
            );
            res.headers_mut().insert(
                actix_web::http::header::HeaderName::from_static("x-ratelimit-tier"),
                actix_web::http::header::HeaderValue::from_str(tier.as_str()).unwrap_or_else(|_| actix_web::http::header::HeaderValue::from_static("free")),
            );
            let res = res.map_into_left_body();

            Ok(res)
        })
    }
}

/// Resolve the rate-limit tier and the dedupe key for this request.
///
/// Priority:
/// 1. `X-API-Key` header → prefix identifies the key tier (sync lookup by prefix).
///    Full DB lookup happens in the API key validation handler; here we use the
///    X-API-Tier header that api key middleware injects after validation.
/// 2. JWT Claims.tier field
/// 3. IP address → default free tier
fn resolve_tier_and_key(req: &ServiceRequest) -> (String, String) {
    // Check for API key tier injected by API key validation middleware
    if let Some(api_tier) = req.headers().get("X-Resolved-Tier") {
        if let Ok(tier) = api_tier.to_str() {
            let tier = normalize_tier(tier);
            let key_prefix = req.headers()
                .get("X-API-Key")
                .and_then(|h| h.to_str().ok())
                .map(|k| safe_prefix(k, 8))
                .unwrap_or_else(|| "apikey".to_string());
            return (tier.to_string(), format!("apikey:{}", key_prefix));
        }
    }

    // Check JWT claims tier
    if let Some(claims) = req.extensions().get::<Claims>() {
        let tier = normalize_tier(claims.tier.as_deref().unwrap_or("free")).to_string();
        let user_id = claims.sub.clone();
        return (tier, format!("user:{}", user_id));
    }

    // Fall back to IP-based free tier
    let ip = req.connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();
    ("free".to_string(), format!("ip:{}", ip))
}

#[cfg(test)]
mod tests {
    use super::{evict_rate_keys, normalize_tier, safe_prefix, TierLimits, MAX_RATE_KEYS};
    use std::collections::HashMap;
    use std::time::{Duration, Instant};

    #[test]
    fn normalize_tier_rejects_unknown_values() {
        assert_eq!(normalize_tier("free"), "free");
        assert_eq!(normalize_tier("enterprise"), "enterprise");
        assert_eq!(normalize_tier("godmode"), "free");
    }

    #[test]
    fn tier_limits_defaults_for_unknown() {
        let limits = TierLimits::default();
        assert_eq!(limits.limit_for("basic"), limits.basic);
        assert_eq!(limits.limit_for("invalid"), limits.free);
    }

    #[test]
    fn safe_prefix_handles_unicode_without_panics() {
        assert_eq!(safe_prefix("abcdefghijk", 8), "abcdefgh");
        assert_eq!(safe_prefix("😀😀😀😀", 3), "😀😀😀");
    }

    #[test]
    fn evict_rate_keys_trims_map_without_full_reset() {
        let now = Instant::now();
        let mut map: HashMap<String, (u32, Instant)> = HashMap::new();
        let initial_len = MAX_RATE_KEYS + 100;
        for i in 0..initial_len {
            map.insert(format!("k{i}"), (1, now - Duration::from_secs((i % 120) as u64)));
        }

        evict_rate_keys(&mut map, now, Duration::from_secs(60));
        assert!(map.len() <= MAX_RATE_KEYS);
        assert!(map.len() < initial_len);
        assert!(!map.is_empty());
    }
}

/// Simple IP-only rate limiter (used as first-line defense for public endpoints).
pub struct RateLimiter {
    requests_per_minute: u32,
    window: Duration,
}

impl RateLimiter {
    pub fn new(requests_per_minute: u32) -> Self {
        Self {
            requests_per_minute,
            window: Duration::from_secs(60),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = RateLimiterMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        std::future::ready(Ok(RateLimiterMiddleware {
            service: Arc::new(service),
            requests_per_minute: self.requests_per_minute,
            window: self.window,
            clients: Arc::new(Mutex::new(HashMap::new())),
        }))
    }
}

pub struct RateLimiterMiddleware<S> {
    service: Arc<S>,
    requests_per_minute: u32,
    window: Duration,
    clients: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
}

impl<S, B> Service<ServiceRequest> for RateLimiterMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    fn poll_ready(&self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let clients = self.clients.clone();
        let limit = self.requests_per_minute;
        let window = self.window;

        Box::pin(async move {
            let ip = req.connection_info()
                .realip_remote_addr()
                .unwrap_or("unknown")
                .to_string();

            let should_limit = {
                let mut clients = match clients.lock() {
                    Ok(guard) => guard,
                    Err(poisoned) => {
                        tracing::error!("RateLimiter mutex poisoned — recovering");
                        poisoned.into_inner()
                    }
                };
                let now = Instant::now();
                evict_rate_keys(&mut clients, now, window);
                let (count, window_start) = clients.entry(ip.clone()).or_insert((0, now));
                if now.duration_since(*window_start) > window {
                    *count = 0;
                    *window_start = now;
                }
                *count += 1;
                *count > limit
            };

            if should_limit {
                let response = HttpResponse::TooManyRequests()
                    .insert_header(("Retry-After", "60"))
                    .json(serde_json::json!({
                        "error": "Rate limit exceeded",
                        "retry_after": 60
                    }));
                return Ok(req.into_response(response).map_into_right_body());
            }

            let res = service.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}
