use actix_web::{web, HttpRequest, HttpResponse, Responder, HttpMessage};
use sqlx::PgPool;
use tracing::error;

use crate::models::UpdateSettingsRequest;
use crate::service::{SettingsService, SettingsError};

fn error_response(err: SettingsError) -> HttpResponse {
    match err {
        SettingsError::Validation(msg) => {
            HttpResponse::BadRequest().json(serde_json::json!({ "error": msg }))
        }
        SettingsError::Database(e) => {
            error!(error = %e, "Settings service database error");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            }))
        }
    }
}

/// GET /settings
///
/// Retrieve the authenticated user's settings.
/// Creates default settings row if none exists.
pub async fn get_settings(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let service = SettingsService::new(pool.get_ref().clone());
    match service.get_settings(user_id).await {
        Ok(settings) => HttpResponse::Ok().json(settings),
        Err(e) => error_response(e),
    }
}

/// PATCH /settings
///
/// Partially update the authenticated user's settings.
/// Only fields included in the request body are modified.
pub async fn update_settings(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<UpdateSettingsRequest>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let service = SettingsService::new(pool.get_ref().clone());
    match service.update_settings(user_id, &body).await {
        Ok(settings) => HttpResponse::Ok().json(settings),
        Err(e) => error_response(e),
    }
}
