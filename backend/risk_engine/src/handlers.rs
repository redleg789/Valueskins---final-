use crate::models::*;
use crate::service::RiskEngineService;
use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use sqlx::PgPool;

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    req.extensions()
        .get::<auth_service::token::Claims>()
        .cloned()
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})))
        .and_then(|claims| {
            claims.sub.parse::<i64>()
                .map_err(|_| HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})))
        })
}

fn internal_error(msg: &str) -> HttpResponse {
    HttpResponse::InternalServerError().json(serde_json::json!({"error": msg}))
}

pub async fn get_risk_assessment(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = RiskEngineService::new((**pool).clone());
    match service.assess_user(user_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(RiskError::UserNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"}))
        }
        Err(_) => internal_error("Failed to assess risk"),
    }
}

pub async fn record_risk_event(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<RecordRiskEventRequest>,
) -> HttpResponse {
    // Only trust & safety team members or system services can record events
    let _user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = RiskEngineService::new((**pool).clone());
    match service.record_event(&body).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(_) => internal_error("Failed to record risk event"),
    }
}

pub async fn run_scan(
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let service = RiskEngineService::new((**pool).clone());
    match service.run_periodic_scan().await {
        Ok(count) => HttpResponse::Ok().json(serde_json::json!({"events_detected": count})),
        Err(_) => internal_error("Failed to run risk scan"),
    }
}

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1/risk")
            .route("/assess", web::get().to(get_risk_assessment))
            .route("/events", web::post().to(record_risk_event))
            .route("/scan", web::post().to(run_scan)),
    );
}
