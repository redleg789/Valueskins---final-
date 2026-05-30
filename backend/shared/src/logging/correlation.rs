//! Correlation ID propagation
//!
//! A unique ID is generated at the API Gateway for every inbound request.
//! It travels through every downstream service call via the `X-Correlation-ID` header.
//! Every log line in every service includes this ID, enabling a single request
//! to be traced across all microservices in Elasticsearch/Kibana.
//!
//! If a platform (e.g. Meta) already sends its own trace ID, we respect it
//! by reading from the incoming header instead of generating a new one.

use actix_web::HttpRequest;
use uuid::Uuid;

/// HTTP header name for correlation ID propagation
pub const CORRELATION_HEADER: &str = "X-Correlation-ID";

/// Extracts the correlation ID from the request, or generates a new one.
///
/// Priority:
/// 1. `X-Correlation-ID` header (set by upstream or gateway)
/// 2. `X-Request-ID` header (common platform convention)
/// 3. `traceparent` header W3C trace context (OpenTelemetry)
/// 4. Generate new UUIDv4
pub fn extract_or_generate(req: &HttpRequest) -> String {
    // Check our standard header first
    if let Some(val) = header_value(req, CORRELATION_HEADER) {
        return val;
    }

    // Fall back to common platform headers
    if let Some(val) = header_value(req, "X-Request-ID") {
        return val;
    }

    // Extract trace ID from W3C traceparent (00-{trace_id}-{span_id}-{flags})
    if let Some(traceparent) = header_value(req, "traceparent") {
        if let Some(trace_id) = traceparent.split('-').nth(1) {
            return trace_id.to_string();
        }
    }

    // No upstream ID: generate a new one
    Uuid::new_v4().to_string()
}

/// Safely reads a header value as a UTF-8 string
fn header_value(req: &HttpRequest, name: &str) -> Option<String> {
    req.headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .filter(|v| !v.is_empty() && v.len() <= 128) // Bound length to prevent abuse
        .map(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test::TestRequest;

    #[test]
    fn generates_uuid_when_no_header() {
        let req = TestRequest::default().to_http_request();
        let id = extract_or_generate(&req);
        assert_eq!(id.len(), 36); // UUIDv4 format
    }

    #[test]
    fn uses_correlation_header_when_present() {
        let req = TestRequest::default()
            .insert_header(("X-Correlation-ID", "abc-123"))
            .to_http_request();
        assert_eq!(extract_or_generate(&req), "abc-123");
    }

    #[test]
    fn uses_request_id_as_fallback() {
        let req = TestRequest::default()
            .insert_header(("X-Request-ID", "req-456"))
            .to_http_request();
        assert_eq!(extract_or_generate(&req), "req-456");
    }

    #[test]
    fn extracts_from_traceparent() {
        let req = TestRequest::default()
            .insert_header(("traceparent", "00-abcdef1234567890abcdef1234567890-1234567890abcdef-01"))
            .to_http_request();
        assert_eq!(extract_or_generate(&req), "abcdef1234567890abcdef1234567890");
    }

    #[test]
    fn rejects_oversized_header() {
        let long_val = "x".repeat(200);
        let req = TestRequest::default()
            .insert_header(("X-Correlation-ID", long_val.as_str()))
            .to_http_request();
        let id = extract_or_generate(&req);
        // Should have generated a new UUID, not used the oversized value
        assert_ne!(id, long_val);
        assert_eq!(id.len(), 36);
    }
}
