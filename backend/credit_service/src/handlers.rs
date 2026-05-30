use actix_web::{web, HttpRequest, HttpResponse, Responder, HttpMessage};
use shared::read_replica::ReplicaRouter;
use tracing::error;

use crate::models::*;
use crate::service::{CreditService, CreditError};

fn error_response(err: CreditError) -> HttpResponse {
    match err {
        CreditError::NotEligible(reason) => HttpResponse::BadRequest().json(serde_json::json!({"error": "Not eligible", "reason": reason})),
        CreditError::InsufficientCredit => HttpResponse::BadRequest().json(serde_json::json!({"error": "Insufficient credit available"})),
        CreditError::InvalidDealRoom => HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid deal room or not the creator"})),
        CreditError::AlreadyExists => HttpResponse::Conflict().json(serde_json::json!({"error": "Credit line already exists"})),
        CreditError::NotFound => HttpResponse::NotFound().json(serde_json::json!({"error": "Credit line not found"})),
        CreditError::Suspended => HttpResponse::Forbidden().json(serde_json::json!({"error": "Credit line is suspended"})),
        CreditError::Timeout => HttpResponse::GatewayTimeout().json(serde_json::json!({"error": "Query timeout"})),
        CreditError::Database(e) => {
            error!(error = %e, "Credit service database error");
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

fn make_service(router: &ReplicaRouter) -> CreditService {
    CreditService::new(router.write_pool().clone(), router.read_pool().clone())
}

pub async fn apply_credit(req: HttpRequest, router: web::Data<ReplicaRouter>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).apply(user_id).await {
        Ok(line) => HttpResponse::Ok().json(serde_json::json!({"credit_line": line})),
        Err(e) => error_response(e),
    }
}

pub async fn get_status(req: HttpRequest, router: web::Data<ReplicaRouter>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).get_status(user_id).await {
        Ok(line) => HttpResponse::Ok().json(line),
        Err(e) => error_response(e),
    }
}

pub async fn get_score(req: HttpRequest, router: web::Data<ReplicaRouter>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).get_score_breakdown(user_id).await {
        Ok(b) => HttpResponse::Ok().json(serde_json::json!({
            "score": b,
            "formula": "completed_deals(max25) + avg_value(max20) + trust(max20) + tenure(max15) + on_time(max20) = 100"
        })),
        Err(e) => error_response(e),
    }
}

pub async fn draw_advance(req: HttpRequest, router: web::Data<ReplicaRouter>, body: web::Json<DrawAdvanceRequest>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).draw_advance(user_id, &body).await {
        Ok(advance) => HttpResponse::Ok().json(serde_json::json!({"advance": advance})),
        Err(e) => error_response(e),
    }
}

pub async fn repay_advance(req: HttpRequest, router: web::Data<ReplicaRouter>, path: web::Path<i64>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).repay_advance(user_id, path.into_inner()).await {
        Ok(advance) => HttpResponse::Ok().json(serde_json::json!({"advance": advance})),
        Err(e) => error_response(e),
    }
}

pub async fn list_advances(req: HttpRequest, router: web::Data<ReplicaRouter>, query: web::Query<AdvanceListQuery>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).list_advances(user_id, &query).await {
        Ok((advances, total_count)) => HttpResponse::Ok().json(serde_json::json!({"advances": advances, "total": total_count})),
        Err(e) => error_response(e),
    }
}
