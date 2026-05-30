use crate::models::*;
use crate::service::CredentialService;
use actix_web::{web, HttpRequest, HttpResponse};
use auth_service::token::Claims;
use sqlx::PgPool;

// Helper to extract user_id from JWT
fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    use actix_web::HttpMessage;

    req.extensions()
        .get::<Claims>()
        .cloned()
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})))
        .and_then(|claims| {
            claims.sub.parse::<i64>()
                .map_err(|_| HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})))
        })
}

pub async fn link_credential(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<LinkCredentialRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = CredentialService::new((**pool).clone());
    match service.link_credential(user_id, body.into_inner()).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(ServiceError::Database(e)) => {
            log::error!("DB error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
        Err(ServiceError::Forbidden) => {
            HttpResponse::Forbidden().json(serde_json::json!({"error": "Forbidden"}))
        }
        Err(ServiceError::NotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"}))
        }
    }
}

pub async fn list_credentials(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = CredentialService::new((**pool).clone());
    match service.list_credentials(user_id).await {
        Ok(credentials) => HttpResponse::Ok().json(credentials),
        Err(ServiceError::Database(e)) => {
            log::error!("DB error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
        Err(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "Internal error"})),
    }
}

pub async fn link_identity(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<LinkIdentityRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = CredentialService::new((**pool).clone());
    match service.link_identity(user_id, body.into_inner()).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(ServiceError::Database(e)) => {
            log::error!("DB error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
        Err(ServiceError::Forbidden) => {
            HttpResponse::Forbidden().json(serde_json::json!({"error": "Forbidden"}))
        }
        Err(ServiceError::NotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"}))
        }
    }
}

pub async fn list_identity_proofs(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = CredentialService::new((**pool).clone());
    match service.list_identity_proofs(user_id).await {
        Ok(proofs) => HttpResponse::Ok().json(proofs),
        Err(ServiceError::Database(e)) => {
            log::error!("DB error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
        Err(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "Internal error"})),
    }
}

pub async fn get_verification_profile(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    let _viewer_user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let profile_user_id = path.into_inner();

    let service = CredentialService::new((**pool).clone());
    match service.get_combined_profile(profile_user_id).await {
        Ok(profile) => HttpResponse::Ok().json(profile),
        Err(ServiceError::Database(e)) => {
            log::error!("DB error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
        Err(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "Internal error"})),
    }
}
