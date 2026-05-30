//! Centralized Logging System for Valueskins Microservices
//!
//! Designed for Meta-scale platform integration:
//! - Structured JSON logs (machine-readable, Elasticsearch/Kibana compatible)
//! - Correlation ID propagation across all services
//! - PII masking for sensitive fields (emails, tokens, addresses)
//! - Environment-aware log levels (production = warn+, staging = info, dev = debug)
//! - Request/response logging middleware for Actix-web
//!
//! Architecture:
//!   Client -> API Gateway (generates correlation_id)
//!          -> Middleware injects correlation_id into all log spans
//!          -> Each service log line includes: correlation_id, service, user_id, method, path
//!          -> Fluentd/Filebeat collects from stdout -> Elasticsearch -> Kibana

pub mod correlation;
pub mod init;
pub mod middleware;
pub mod pii;
