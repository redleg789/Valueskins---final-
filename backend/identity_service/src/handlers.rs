use crate::age_verification::AgeVerificationService;
use crate::document_verification::DocumentVerificationService;
use crate::kyc::KycService;
use crate::models::*;
use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use sqlx::PgPool;

// Helper: extract user_id from JWT claims in request extensions
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

// ============================================================
// Age Verification Endpoints
// ============================================================

pub async fn submit_dob(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<SubmitDobRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = AgeVerificationService::new((**pool).clone());
    match service.submit_dob(user_id, &body).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            tracing::error!(user_id, error = %e, "DOB submission failed");
            match e {
                IdentityError::InvalidDob(msg) | IdentityError::InvalidStateTransition(msg) => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
                }
                IdentityError::UserNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"}))
                }
                IdentityError::AgeAlreadyVerified => {
                    HttpResponse::Conflict().json(serde_json::json!({"error": "Age already verified"}))
                }
                _ => internal_error("Failed to submit date of birth"),
            }
        }
    }
}

pub async fn get_age_status(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = AgeVerificationService::new((**pool).clone());
    match service.get_status(user_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(IdentityError::UserNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Verification profile not found"}))
        }
        Err(_) => internal_error("Failed to get age status"),
    }
}

// ============================================================
// Document Verification Endpoints
// ============================================================

pub async fn upload_document(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<UploadDocumentRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = DocumentVerificationService::new((**pool).clone());
    match service.upload_document(user_id, &body).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            tracing::error!(user_id, error = %e, "Document upload failed");
            match e {
                IdentityError::DocumentAlreadyExists => {
                    HttpResponse::Conflict().json(serde_json::json!({"error": "Document already uploaded"}))
                }
                IdentityError::DocumentVerificationFailed(msg) => {
                    HttpResponse::UnprocessableEntity().json(serde_json::json!({"error": msg}))
                }
                _ => internal_error("Failed to upload document"),
            }
        }
    }
}

pub async fn get_document_status(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let document_id = path.into_inner();

    let service = DocumentVerificationService::new((**pool).clone());
    match service.get_document_status(document_id, user_id).await {
        Ok(doc) => HttpResponse::Ok().json(doc),
        Err(IdentityError::DocumentNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Document not found"}))
        }
        Err(_) => internal_error("Failed to get document status"),
    }
}

// ============================================================
// KYC Endpoints
// ============================================================

pub async fn get_kyc_status(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = KycService::new((**pool).clone());
    match service.get_kyc_status(user_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(IdentityError::KycNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "KYC not initialized"}))
        }
        Err(_) => internal_error("Failed to get KYC status"),
    }
}

pub async fn init_kyc(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = KycService::new((**pool).clone());
    match service.init_kyc(user_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(_) => internal_error("Failed to initialize KYC"),
    }
}

// ============================================================
// Route Configuration
// ============================================================

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1/identity")
            .route("/age/dob", web::post().to(submit_dob))
            .route("/age/status", web::get().to(get_age_status))
            .route("/documents/upload", web::post().to(upload_document))
            .route("/documents/{id}", web::get().to(get_document_status))
            .route("/kyc/status", web::get().to(get_kyc_status))
            .route("/kyc/init", web::post().to(init_kyc)),
    );
}
