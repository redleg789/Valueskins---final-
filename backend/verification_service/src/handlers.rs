use crate::models::*;
use crate::service::VerificationService;
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

pub async fn create_company(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<CreateCompanyRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = VerificationService::new((**pool).clone());
    match service.create_company(user_id, &body).await {
        Ok(company) => HttpResponse::Ok().json(company),
        Err(e) => {
            match e {
                VerificationError::Forbidden(msg) => HttpResponse::Forbidden().json(serde_json::json!({"error": msg})),
                VerificationError::CompanyAlreadyExists => HttpResponse::Conflict().json(serde_json::json!({"error": "Company already exists"})),
                VerificationError::DomainVerificationFailed(msg) => HttpResponse::BadRequest().json(serde_json::json!({"error": msg})),
                _ => internal_error("Failed to create company"),
            }
        }
    }
}

pub async fn initiate_domain_verification(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<InitiateDomainVerificationRequest>,
) -> HttpResponse {
    let _user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = VerificationService::new((**pool).clone());
    match service.initiate_domain_verification(body.company_id, &body.domain).await {
        Ok(instructions) => HttpResponse::Ok().json(serde_json::json!({"instructions": instructions})),
        Err(_) => internal_error("Failed to initiate domain verification"),
    }
}

pub async fn verify_domain(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<VerifyDomainRequest>,
) -> HttpResponse {
    let _user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = VerificationService::new((**pool).clone());
    match service.verify_domain(body.company_id, &body.domain, &body.verification_token).await {
        Ok(company) => HttpResponse::Ok().json(company),
        Err(VerificationError::DomainVerificationFailed(msg)) => HttpResponse::BadRequest().json(serde_json::json!({"error": msg})),
        Err(_) => internal_error("Failed to verify domain"),
    }
}

pub async fn initiate_employee_verification(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<InitiateEmployeeVerificationRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = VerificationService::new((**pool).clone());
    match service.initiate_employee_verification(user_id, &body).await {
        Ok(verification) => HttpResponse::Ok().json(verification),
        Err(e) => {
            match e {
                VerificationError::Forbidden(msg) => HttpResponse::Forbidden().json(serde_json::json!({"error": msg})),
                VerificationError::DomainVerificationFailed(msg) => HttpResponse::BadRequest().json(serde_json::json!({"error": msg})),
                _ => internal_error("Failed to initiate employee verification"),
            }
        }
    }
}

pub async fn complete_employee_verification(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let verification_id = path.into_inner();
    let service = VerificationService::new((**pool).clone());
    match service.complete_employee_verification(verification_id, user_id).await {
        Ok(verification) => HttpResponse::Ok().json(verification),
        Err(e) => {
            match e {
                VerificationError::EmployeeVerificationNotFound => HttpResponse::NotFound().json(serde_json::json!({"error": "Verification not found"})),
                VerificationError::Forbidden(msg) => HttpResponse::BadRequest().json(serde_json::json!({"error": msg})),
                _ => internal_error("Failed to complete verification"),
            }
        }
    }
}

pub async fn get_company_status(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    let _user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let company_id = path.into_inner();
    let service = VerificationService::new((**pool).clone());
    match service.get_company_status(company_id).await {
        Ok(status) => HttpResponse::Ok().json(status),
        Err(VerificationError::CompanyNotFound) => HttpResponse::NotFound().json(serde_json::json!({"error": "Company not found"})),
        Err(_) => internal_error("Failed to get company status"),
    }
}

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1/verification")
            .route("/companies", web::post().to(create_company))
            .route("/companies/{id}/status", web::get().to(get_company_status))
            .route("/companies/{id}/domain/initiate", web::post().to(initiate_domain_verification))
            .route("/companies/{id}/domain/verify", web::post().to(verify_domain))
            .route("/employees/verify", web::post().to(initiate_employee_verification))
            .route("/employees/{id}/confirm", web::post().to(complete_employee_verification)),
    );
}
