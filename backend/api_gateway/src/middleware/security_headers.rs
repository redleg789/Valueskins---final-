//! Security headers middleware.
//!
//! Adds OWASP-recommended security headers to every response.
//! Without these, the API is vulnerable to:
//! - Clickjacking (missing X-Frame-Options)
//! - MIME-type sniffing attacks (missing X-Content-Type-Options)
//! - Downgrade attacks (missing Strict-Transport-Security)
//! - XSS via injected scripts (missing Content-Security-Policy)

use actix_web::middleware::DefaultHeaders;

/// Returns a DefaultHeaders middleware with production security headers.
///
/// Usage in main.rs:
/// ```rust
/// App::new()
///     .wrap(security_headers())
///     // ... routes
/// ```
pub fn security_headers() -> DefaultHeaders {
    DefaultHeaders::new()
        // Prevent clickjacking: no framing allowed
        .add(("X-Frame-Options", "DENY"))
        // Prevent MIME-type sniffing
        .add(("X-Content-Type-Options", "nosniff"))
        // Force HTTPS for 1 year, include subdomains
        .add(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
        // Minimal CSP for API (no inline scripts, no eval)
        .add(("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"))
        // Disable browser features we don't need
        .add(("Permissions-Policy", "camera=(), microphone=(), geolocation=()"))
        // Control referrer leakage
        .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
        // Prevent caching of authenticated responses
        .add(("Cache-Control", "no-store, no-cache, must-revalidate"))
        .add(("Pragma", "no-cache"))
}
