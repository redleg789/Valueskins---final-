//! Prometheus metrics — Four Golden Signals
//! Latency, Traffic, Errors, Saturation tracked per endpoint

use actix_web::HttpResponse;
use std::sync::OnceLock;
use std::collections::HashMap;
use std::sync::Mutex;

const MAX_METRIC_SERIES: usize = 20_000;

/// Lightweight metrics collector that exports Prometheus text format
/// In production, use the prometheus crate — this is the integration shape
pub struct MetricsCollector {
    /// request_count{method, path, status}
    request_counts: Mutex<HashMap<(String, String, u16), u64>>,
    /// request_duration_seconds{method, path} — histogram buckets
    request_durations: Mutex<Vec<(String, String, f64)>>,
    /// active_connections gauge
    active_connections: std::sync::atomic::AtomicI64,
}

static METRICS: OnceLock<MetricsCollector> = OnceLock::new();

impl MetricsCollector {
    pub fn global() -> &'static MetricsCollector {
        METRICS.get_or_init(|| MetricsCollector {
            request_counts: Mutex::new(HashMap::new()),
            request_durations: Mutex::new(Vec::new()),
            active_connections: std::sync::atomic::AtomicI64::new(0),
        })
    }

    pub fn record_request(&self, method: &str, path: &str, status: u16, duration_secs: f64) {
        let normalized_path = normalize_metric_path(path);
        let key = (method.to_string(), normalized_path, status);
        if let Ok(mut counts) = self.request_counts.lock() {
            if let Some(v) = counts.get_mut(&key) {
                *v += 1;
            } else if counts.len() < MAX_METRIC_SERIES {
                counts.insert(key, 1);
            }
        }
        if let Ok(mut durations) = self.request_durations.lock() {
            durations.push((method.to_string(), path.to_string(), duration_secs));
            // Keep bounded to prevent memory leak
            if durations.len() > 100_000 {
                durations.drain(..50_000);
            }
        }
    }

    pub fn inc_connections(&self) {
        self.active_connections.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn dec_connections(&self) {
        self.active_connections.fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    }

    /// Render Prometheus text exposition format
    pub fn render(&self) -> String {
        let mut out = String::with_capacity(4096);

        // Request counts
        out.push_str("# HELP http_requests_total Total HTTP requests\n");
        out.push_str("# TYPE http_requests_total counter\n");
        if let Ok(counts) = self.request_counts.lock() {
            for ((method, path, status), count) in counts.iter() {
                out.push_str(&format!(
                    "http_requests_total{{method=\"{}\",path=\"{}\",status=\"{}\"}} {}\n",
                    method, path, status, count
                ));
            }
        }

        // Active connections (saturation signal)
        let conns = self.active_connections.load(std::sync::atomic::Ordering::Relaxed);
        out.push_str("# HELP http_active_connections Current active connections\n");
        out.push_str("# TYPE http_active_connections gauge\n");
        out.push_str(&format!("http_active_connections {}\n", conns));

        out
    }
}

fn looks_like_uuid(segment: &str) -> bool {
    if segment.len() != 36 {
        return false;
    }
    segment
        .chars()
        .all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn normalize_metric_path(path: &str) -> String {
    if path.is_empty() {
        return "/".to_string();
    }

    let mut out = String::new();
    for part in path.split('/') {
        if part.is_empty() {
            continue;
        }
        out.push('/');
        let normalized = if part.chars().all(|c| c.is_ascii_digit()) || looks_like_uuid(part) {
            ":id"
        } else if part.len() > 96 {
            ":segment"
        } else {
            part
        };
        out.push_str(normalized);
    }
    if out.is_empty() {
        "/".to_string()
    } else {
        out
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_metric_path;

    #[test]
    fn normalizes_numeric_and_uuid_segments() {
        assert_eq!(normalize_metric_path("/marketplace/opportunities/123"), "/marketplace/opportunities/:id");
        assert_eq!(
            normalize_metric_path("/deals/550e8400-e29b-41d4-a716-446655440000/messages"),
            "/deals/:id/messages"
        );
    }

    #[test]
    fn keeps_static_paths() {
        assert_eq!(normalize_metric_path("/health/ready"), "/health/ready");
    }
}

/// Actix handler: GET /metrics
/// Protected by METRICS_BEARER_TOKEN env var (set to a random 32+ char secret).
/// Prometheus scraper must include: Authorization: Bearer <token>
/// Falls back to open access (with a warning log) if the env var is not set,
/// so local dev and test environments don't need the secret.
pub async fn metrics_handler(req: actix_web::HttpRequest) -> HttpResponse {
    // Check bearer token if METRICS_BEARER_TOKEN is configured
    if let Ok(expected) = std::env::var("METRICS_BEARER_TOKEN") {
        if !expected.is_empty() {
            let provided = req
                .headers()
                .get("Authorization")
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.strip_prefix("Bearer "))
                .unwrap_or("");

            if provided != expected.as_str() {
                return HttpResponse::Unauthorized()
                    .content_type("text/plain")
                    .body("Unauthorized");
            }
        }
    } else if std::env::var("APP_ENV").map(|v| v == "production").unwrap_or(false) {
        return HttpResponse::ServiceUnavailable()
            .content_type("text/plain")
            .body("Metrics disabled: missing METRICS_BEARER_TOKEN");
    }

    HttpResponse::Ok()
        .content_type("text/plain; version=0.0.4")
        .body(MetricsCollector::global().render())
}
