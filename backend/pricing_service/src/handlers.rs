use actix_web::{web, HttpRequest, HttpResponse, Responder, HttpMessage};
use shared::read_replica::ReplicaRouter;
use tracing::error;

use crate::models::*;
use crate::service::{PricingService, PricingError};

fn error_response(err: PricingError) -> HttpResponse {
    match err {
        PricingError::InvalidLevel => {
            HttpResponse::BadRequest().json(serde_json::json!({"error": "Level must be between 1 and 5"}))
        }
        PricingError::InsufficientData => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "No benchmark data available for this combination"}))
        }
        PricingError::RateLimited => {
            HttpResponse::TooManyRequests().json(serde_json::json!({"error": "Rate limited"}))
        }
        PricingError::Timeout => {
            HttpResponse::GatewayTimeout().json(serde_json::json!({"error": "Query timeout"}))
        }
        PricingError::Database(e) => {
            error!(error = %e, "Pricing service database error");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Internal server error"}))
        }
    }
}

fn extract_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    let claims = req.extensions().get::<auth_service::token::Claims>().cloned()
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})))?;
    claims.sub.parse::<i64>()
        .map_err(|_| HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})))
}

/// GET /pricing/benchmark
pub async fn get_benchmark(
    router: web::Data<ReplicaRouter>,
    query: web::Query<BenchmarkQuery>,
) -> impl Responder {
    let service = PricingService::new(router.write_pool().clone(), router.read_pool().clone());
    match service.get_benchmark(&query).await {
        Ok(benchmark) => HttpResponse::Ok().json(serde_json::json!({"benchmark": benchmark})),
        Err(e) => error_response(e),
    }
}

/// GET /pricing/my-worth
pub async fn get_personal_valuation(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    query: web::Query<ValuationQuery>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    let service = PricingService::new(router.write_pool().clone(), router.read_pool().clone());
    match service.get_personal_valuation(user_id, &query).await {
        Ok(valuation) => HttpResponse::Ok().json(serde_json::json!({"valuation": valuation})),
        Err(e) => error_response(e),
    }
}

/// POST /pricing/recompute (admin only)
pub async fn recompute_benchmarks(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    body: web::Json<RecomputeRequest>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };
    if claims.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": "Admin access required"}));
    }
    let service = PricingService::new(router.write_pool().clone(), router.read_pool().clone());
    match service.recompute_benchmarks(body.category.as_deref(), body.platform.as_deref()).await {
        Ok(version) => HttpResponse::Ok().json(serde_json::json!({"version": version, "message": "Benchmarks recomputed"})),
        Err(e) => error_response(e),
    }
}
