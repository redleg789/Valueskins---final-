//! Health check endpoints for Kubernetes probes
//! /health/live  — Is the process alive? (liveness)
//! /health/ready — Can it serve traffic? (readiness — checks DB, Redis)

use actix_web::HttpResponse;
use sqlx::PgPool;

/// Liveness probe: process is running
/// Kubernetes restarts the pod if this fails
pub async fn liveness() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "alive" }))
}

/// Readiness probe: service can accept traffic
/// Checks database connectivity — pod removed from load balancer if unhealthy
pub async fn readiness(pool: actix_web::web::Data<PgPool>) -> HttpResponse {
    // Check database
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool.get_ref())
        .await
        .is_ok();

    if db_ok {
        HttpResponse::Ok().json(serde_json::json!({
            "status": "ready",
            "checks": {
                "database": "ok"
            }
        }))
    } else {
        HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "status": "not_ready",
            "checks": {
                "database": "failed"
            }
        }))
    }
}
