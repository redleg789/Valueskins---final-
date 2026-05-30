//! Request Logging Middleware for Actix-web
//!
//! Wraps every HTTP request with structured logging that includes:
//! - Correlation ID (generated or extracted from upstream)
//! - HTTP method, path, status code
//! - Request duration in milliseconds
//! - User ID (extracted from extensions if set by auth middleware)
//! - Client IP (masked for GDPR/privacy compliance)
//!
//! The middleware does NOT depend on auth_service directly.
//! Instead, it reads a `LogUserId` value from request extensions,
//! which the auth middleware injects after JWT validation.
//!
//! Log output is JSON to stdout, consumed by Fluentd -> Elasticsearch -> Kibana.

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage,
};
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};
use std::rc::Rc;
use std::time::Instant;

use super::correlation;
use crate::observability::metrics::MetricsCollector;
use super::pii;

/// Lightweight user ID container injected by auth middleware.
/// Decouples logging from auth_service to avoid circular dependencies.
///
/// Auth middleware should do:
/// ```ignore
/// req.extensions_mut().insert(LogUserId(claims.sub.clone()));
/// ```
#[derive(Clone, Debug)]
pub struct LogUserId(pub String);

/// Correlation ID stored in request extensions.
/// Downstream handlers extract this to include in their own log calls.
///
/// Usage in any handler:
/// ```ignore
/// fn my_handler(req: HttpRequest) -> impl Responder {
///     let corr_id = req.extensions().get::<CorrelationId>()
///         .map(|c| c.0.as_str()).unwrap_or("-");
///     tracing::info!(correlation_id = corr_id, "Processing");
/// }
/// ```
#[derive(Clone, Debug)]
pub struct CorrelationId(pub String);

/// Service name injected at startup — appears in every log line
pub struct RequestLogger {
    service_name: String,
}

impl RequestLogger {
    pub fn new(service_name: &str) -> Self {
        Self {
            service_name: service_name.to_string(),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RequestLogger
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequestLoggerMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequestLoggerMiddleware {
            service: Rc::new(service),
            service_name: self.service_name.clone(),
        }))
    }
}

pub struct RequestLoggerMiddleware<S> {
    service: Rc<S>,
    service_name: String,
}

impl<S, B> Service<ServiceRequest> for RequestLoggerMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let service_name = self.service_name.clone();
        let start = Instant::now();

        // Extract or generate correlation ID
        let correlation_id = correlation::extract_or_generate(req.request());

        // Extract request metadata
        let method = req.method().to_string();
        let path = req.path().to_string();
        let query = sanitize_log_query(req.query_string());

        // Extract client IP (masked for privacy)
        let client_ip = req
            .connection_info()
            .realip_remote_addr()
            .map(|ip| pii::mask_ip(ip))
            .unwrap_or_else(|| "unknown".to_string());

        // Inject correlation ID into request extensions
        req.extensions_mut().insert(CorrelationId(correlation_id.clone()));

        Box::pin(async move {
            let result = service.call(req).await;

            let duration_ms = start.elapsed().as_millis() as u64;

            match &result {
                Ok(response) => {
                    // Extract user_id from extensions (set by auth middleware)
                    let user_id = response
                        .request()
                        .extensions()
                        .get::<LogUserId>()
                        .map(|u| u.0.clone());

                    let status = response.status().as_u16();
                    MetricsCollector::global().record_request(
                        method.as_str(),
                        path.as_str(),
                        status,
                        duration_ms as f64 / 1000.0,
                    );

                    if status >= 500 {
                        tracing::error!(
                            service = service_name.as_str(),
                            correlation_id = correlation_id.as_str(),
                            method = method.as_str(),
                            path = path.as_str(),
                            query = query.as_str(),
                            status = status,
                            duration_ms = duration_ms,
                            user_id = user_id.as_deref().unwrap_or("-"),
                            client_ip = client_ip.as_str(),
                            "Request failed"
                        );
                    } else if status >= 400 {
                        tracing::warn!(
                            service = service_name.as_str(),
                            correlation_id = correlation_id.as_str(),
                            method = method.as_str(),
                            path = path.as_str(),
                            query = query.as_str(),
                            status = status,
                            duration_ms = duration_ms,
                            user_id = user_id.as_deref().unwrap_or("-"),
                            client_ip = client_ip.as_str(),
                            "Client error"
                        );
                    } else {
                        tracing::info!(
                            service = service_name.as_str(),
                            correlation_id = correlation_id.as_str(),
                            method = method.as_str(),
                            path = path.as_str(),
                            status = status,
                            duration_ms = duration_ms,
                            user_id = user_id.as_deref().unwrap_or("-"),
                            "Request completed"
                        );
                    }
                }
                Err(err) => {
                    MetricsCollector::global().record_request(
                        method.as_str(),
                        path.as_str(),
                        500,
                        duration_ms as f64 / 1000.0,
                    );
                    tracing::error!(
                        service = service_name.as_str(),
                        correlation_id = correlation_id.as_str(),
                        method = method.as_str(),
                        path = path.as_str(),
                        duration_ms = duration_ms,
                        error = %err,
                        "Request error"
                    );
                }
            }

            result
        })
    }
}

fn sanitize_log_query(query: &str) -> String {
    const MAX_QUERY_LOG_LEN: usize = 512;
    let mut cleaned = String::with_capacity(query.len().min(MAX_QUERY_LOG_LEN));
    for ch in query.chars() {
        if ch.is_control() {
            cleaned.push('?');
        } else {
            cleaned.push(ch);
        }
        if cleaned.len() >= MAX_QUERY_LOG_LEN {
            break;
        }
    }
    cleaned
}

#[cfg(test)]
mod tests {
    use super::sanitize_log_query;

    #[test]
    fn query_sanitization_redacts_control_bytes_and_caps_length() {
        assert_eq!(sanitize_log_query("a=1\nb=2"), "a=1?b=2");
        assert_eq!(sanitize_log_query(&"x".repeat(1024)).len(), 512);
    }
}
