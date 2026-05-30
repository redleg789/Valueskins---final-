//! Log system initialization
//!
//! Called once at service startup. Configures:
//! - JSON structured output to stdout (collected by Fluentd DaemonSet)
//! - Environment-based log level filtering
//! - tracing-subscriber with actix-web integration

use tracing_subscriber::{
    fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter,
};

/// Initializes the structured logging pipeline for a microservice.
///
/// # Log Format (JSON)
/// ```json
/// {
///   "timestamp": "2026-02-17T12:00:00.000Z",
///   "level": "INFO",
///   "target": "marketplace_service::service",
///   "service": "api-gateway",
///   "correlation_id": "abc-123",
///   "message": "Deal completed",
///   "fields": { "deal_id": 42, "amount": 500 }
/// }
/// ```
///
/// # Environment Control
/// - `RUST_LOG` env var controls filtering (e.g. `info,sqlx=warn,api_gateway=debug`)
/// - `LOG_FORMAT` env var: `json` (default in production) or `pretty` (local dev)
/// - Production defaults to `warn` for third-party crates, `info` for valueskins
pub fn init(service_name: &str) {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        // Production-safe defaults: info for our code, warn for deps
        EnvFilter::new(format!(
            "warn,{}=info,shared=info,auth_service=info,marketplace_service=info,\
             communities_service=info,referral_service=info,credential_service=info,\
             brand_api=info,notification_service=info,waitlist_service=info",
            service_name.replace('-', "_")
        ))
    });

    let log_format = std::env::var("LOG_FORMAT").unwrap_or_else(|_| "json".to_string());

    if log_format == "pretty" {
        // Human-readable for local development
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                fmt::layer()
                    .with_target(true)
                    .with_thread_ids(false)
                    .with_file(true)
                    .with_line_number(true)
                    .pretty(),
            )
            .init();
    } else {
        // JSON for production — consumed by Fluentd -> Elasticsearch
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                fmt::layer()
                    .json()
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_file(true)
                    .with_line_number(true)
                    .with_span_events(fmt::format::FmtSpan::CLOSE)
                    .flatten_event(true),
            )
            .init();
    }

    tracing::info!(
        service = service_name,
        format = log_format.as_str(),
        "Logging initialized"
    );
}
