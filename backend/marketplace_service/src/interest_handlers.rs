use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde_json::json;
use sqlx::PgPool;
use crate::interest_service::{InterestService, CreateInterestSignupRequest};

fn require_admin(req: &HttpRequest) -> Result<i64, HttpResponse> {
    let extensions = req.extensions();
    let claims = extensions
        .get::<auth_service::token::Claims>()
        .ok_or_else(|| HttpResponse::Unauthorized().json(json!({"error": "Authentication required"})))?;

    if claims.role != "admin" {
        return Err(HttpResponse::Forbidden().json(json!({"error": "Admin access required"})));
    }

    claims
        .sub
        .parse::<i64>()
        .map_err(|_| HttpResponse::Unauthorized().json(json!({"error": "Invalid authentication token"})))
}

/// POST /interest/signup - Create new creator interest signup (public endpoint)
pub async fn create_interest_signup(
    pool: web::Data<PgPool>,
    req: web::Json<CreateInterestSignupRequest>,
) -> HttpResponse {
    let service = InterestService::new(pool.get_ref().clone());

    match service.create_signup(req.into_inner()).await {
        Ok(signup) => HttpResponse::Created().json(json!({
            "id": signup.id,
            "instagram_handle": signup.instagram_handle,
            "status": signup.status,
            "created_at": signup.created_at,
            "message": "Thank you for your interest! We'll review your application and contact you soon."
        })),
        Err(crate::interest_service::ServiceError::DuplicateSignup) => {
            HttpResponse::Conflict().json(json!({
                "error": "This Instagram handle is already registered"
            }))
        }
        Err(crate::interest_service::ServiceError::Database(e)) => {
            log::error!("Database error creating interest signup: {:?}", e);
            HttpResponse::InternalServerError().json(json!({
                "error": "Failed to create signup. Please try again."
            }))
        }
        _ => HttpResponse::InternalServerError().json(json!({
            "error": "An error occurred"
        })),
    }
}

/// GET /interest/signup/{id} - Get signup details (public)
pub async fn get_interest_signup(
    pool: web::Data<PgPool>,
    signup_id: web::Path<i64>,
) -> HttpResponse {
    let service = InterestService::new(pool.get_ref().clone());

    match service.get_signup(signup_id.into_inner()).await {
        Ok(signup) => HttpResponse::Ok().json(json!({
            "id": signup.id,
            "instagram_handle": signup.instagram_handle,
            "name": signup.name,
            "email": signup.email,
            "status": signup.status,
            "created_at": signup.created_at,
        })),
        Err(crate::interest_service::ServiceError::NotFound) => {
            HttpResponse::NotFound().json(json!({"error": "Signup not found"}))
        }
        _ => HttpResponse::InternalServerError().json(json!({"error": "An error occurred"})),
    }
}

/// GET /admin/interest/signups - List all signups (admin only)
pub async fn list_interest_signups(
    pool: web::Data<PgPool>,
    query: web::Query<std::collections::HashMap<String, String>>,
    req: HttpRequest,
) -> HttpResponse {
    if let Err(resp) = require_admin(&req) {
        return resp;
    }

    let status = query.get("status").map(|s| s.as_str());
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(50);
    let offset = query
        .get("offset")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    let service = InterestService::new(pool.get_ref().clone());

    match service.list_signups(status, limit.min(500), offset).await {
        Ok((signups, total)) => HttpResponse::Ok().json(json!({
            "signups": signups,
            "total": total,
            "limit": limit,
            "offset": offset,
        })),
        Err(_) => HttpResponse::InternalServerError().json(json!({"error": "Failed to fetch signups"})),
    }
}

/// GET /admin/interest/stats - Get conversion statistics (admin only)
pub async fn get_interest_stats(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> HttpResponse {
    if let Err(resp) = require_admin(&req) {
        return resp;
    }

    let service = InterestService::new(pool.get_ref().clone());

    match service.get_stats().await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(_) => HttpResponse::InternalServerError().json(json!({"error": "Failed to fetch stats"})),
    }
}

/// POST /admin/interest/signups/{id}/contact - Mark as contacted (admin only)
pub async fn contact_interest_signup(
    pool: web::Data<PgPool>,
    signup_id: web::Path<i64>,
    req: HttpRequest,
) -> HttpResponse {
    let admin_user_id = match require_admin(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = InterestService::new(pool.get_ref().clone());

    match service.contact_signup(signup_id.into_inner(), admin_user_id).await {
        Ok(signup) => HttpResponse::Ok().json(json!({
            "id": signup.id,
            "status": signup.status,
            "contacted_at": signup.contacted_at,
            "message": "Marked as contacted"
        })),
        Err(crate::interest_service::ServiceError::NotFound) => {
            HttpResponse::NotFound().json(json!({"error": "Signup not found"}))
        }
        _ => HttpResponse::InternalServerError().json(json!({"error": "An error occurred"})),
    }
}

/// POST /admin/interest/signups/{id}/convert - Convert to user account (admin only)
pub async fn convert_interest_signup(
    pool: web::Data<PgPool>,
    signup_id: web::Path<i64>,
    body: web::Json<serde_json::Value>,
    req: HttpRequest,
) -> HttpResponse {
    if let Err(resp) = require_admin(&req) {
        return resp;
    }

    let user_id = match body.get("user_id").and_then(|v| v.as_i64()) {
        Some(uid) => uid,
        None => {
            return HttpResponse::BadRequest().json(json!({"error": "user_id required"}))
        }
    };

    let service = InterestService::new(pool.get_ref().clone());

    match service.convert_signup(signup_id.into_inner(), user_id).await {
        Ok(signup) => HttpResponse::Ok().json(json!({
            "id": signup.id,
            "status": signup.status,
            "converted_user_id": signup.converted_user_id,
            "message": "Signup converted to user"
        })),
        Err(crate::interest_service::ServiceError::NotFound) => {
            HttpResponse::NotFound().json(json!({"error": "Signup not found"}))
        }
        _ => HttpResponse::InternalServerError().json(json!({"error": "An error occurred"})),
    }
}

/// POST /admin/interest/signups/{id}/reject - Reject signup (admin only)
pub async fn reject_interest_signup(
    pool: web::Data<PgPool>,
    signup_id: web::Path<i64>,
    body: web::Json<serde_json::Value>,
    req: HttpRequest,
) -> HttpResponse {
    let admin_user_id = match require_admin(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let reason = match body.get("reason").and_then(|v| v.as_str()) {
        Some(r) => r,
        None => "No reason provided",
    };

    let service = InterestService::new(pool.get_ref().clone());

    match service.reject_signup(signup_id.into_inner(), admin_user_id, reason).await {
        Ok(signup) => HttpResponse::Ok().json(json!({
            "id": signup.id,
            "status": signup.status,
            "reason": reason,
            "message": "Signup rejected"
        })),
        Err(crate::interest_service::ServiceError::NotFound) => {
            HttpResponse::NotFound().json(json!({"error": "Signup not found"}))
        }
        _ => HttpResponse::InternalServerError().json(json!({"error": "An error occurred"})),
    }
}
