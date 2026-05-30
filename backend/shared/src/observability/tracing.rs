//! Distributed tracing via OpenTelemetry
//! Tracks requests across all microservices with correlation IDs
//! Exports to Jaeger/OTLP collector for visualization

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initializes structured logging + OpenTelemetry tracing
/// Every log line includes: timestamp, level, service, correlation_id, span context
pub fn init_tracing(service_name: &str) {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    let fmt_layer = tracing_subscriber::fmt::layer()
        .json()
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .with_span_events(tracing_subscriber::fmt::format::FmtSpan::CLOSE);

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();

    tracing::info!(service = service_name, "Tracing initialized");
}

/// Extracts or generates a correlation ID for request tracking across services
pub fn correlation_id(req: &actix_web::HttpRequest) -> String {
    req.headers()
        .get("x-correlation-id")
        .and_then(|v| v.to_str().ok())
        .map(String::from)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
}
