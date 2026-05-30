use actix_web::{web, HttpRequest, HttpResponse, Responder, HttpMessage};
use tracing::error;
use std::sync::Arc;

use crate::models::*;
use crate::service::{ReputationService, ReputationError};

fn error_response(err: ReputationError) -> HttpResponse {
    match err {
        ReputationError::NotFound => HttpResponse::NotFound().json(serde_json::json!({"error": "Reputation export not found"})),
        ReputationError::NotAuthorized => HttpResponse::Forbidden().json(serde_json::json!({"error": "Not authorized"})),
        ReputationError::InvalidSignature => HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid signature"})),
        ReputationError::SigningKeyMissing => {
            error!("Ed25519 signing key not configured");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Signing service unavailable"}))
        }
        ReputationError::Timeout => HttpResponse::GatewayTimeout().json(serde_json::json!({"error": "Query timeout"})),
        ReputationError::Database(e) => {
            error!(error = %e, "Reputation service database error");
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

pub async fn generate_export(
    req: HttpRequest,
    svc: web::Data<Arc<ReputationService>>,
    query: web::Query<ExportQuery>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match svc.generate_export(user_id, query.persona_id).await {
        Ok(export) => HttpResponse::Created().json(serde_json::json!({
            "export": export, "public_key": svc.public_key_b64()
        })),
        Err(e) => error_response(e),
    }
}

pub async fn verify_export(
    svc: web::Data<Arc<ReputationService>>,
    query: web::Query<VerifyQuery>,
) -> impl Responder {
    match svc.verify(query.persona_id, query.version).await {
        Ok(result) => HttpResponse::Ok().json(serde_json::json!({
            "verification": result,
            "message": if result.valid { "Signature is valid" } else { "Signature verification FAILED" }
        })),
        Err(e) => error_response(e),
    }
}

pub async fn list_exports(
    req: HttpRequest,
    svc: web::Data<Arc<ReputationService>>,
    query: web::Query<ExportListQuery>,
) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match svc.list_exports(user_id, &query).await {
        Ok((exports, total_count)) => HttpResponse::Ok().json(serde_json::json!({"exports": exports, "total": total_count})),
        Err(e) => error_response(e),
    }
}

pub async fn get_public_key(svc: web::Data<Arc<ReputationService>>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "public_key": svc.public_key_b64(), "algorithm": "Ed25519", "encoding": "base64"
    }))
}
