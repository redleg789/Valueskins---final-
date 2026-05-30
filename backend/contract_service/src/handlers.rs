use actix_web::{web, HttpRequest, HttpResponse, Responder, HttpMessage};
use shared::read_replica::ReplicaRouter;
use sqlx;
use tracing::error;

use crate::models::*;
use crate::service::{ContractService, ContractError};

fn error_response(err: ContractError) -> HttpResponse {
    match err {
        ContractError::NotFound => HttpResponse::NotFound().json(serde_json::json!({"error": "Contract not found"})),
        ContractError::NotAuthorized => HttpResponse::Forbidden().json(serde_json::json!({"error": "Not a participant in this deal"})),
        ContractError::AlreadyExists => HttpResponse::Conflict().json(serde_json::json!({"error": "Contract already exists for this deal room"})),
        ContractError::AlreadySigned => HttpResponse::Conflict().json(serde_json::json!({"error": "Already signed by this party"})),
        ContractError::HashMismatch => HttpResponse::BadRequest().json(serde_json::json!({"error": "Contract hash mismatch — possible tampering"})),
        ContractError::RevisionCapExceeded => HttpResponse::BadRequest().json(serde_json::json!({"error": "Free revision cap exceeded"})),
        ContractError::InvalidTemplate => HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid contract template type"})),
        ContractError::InvalidStatus(s) => HttpResponse::BadRequest().json(serde_json::json!({"error": format!("Invalid state: {}", s)})),
        ContractError::Timeout => HttpResponse::GatewayTimeout().json(serde_json::json!({"error": "Query timeout"})),
        ContractError::Database(e) => {
            error!(error = %e, "Contract service database error");
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

fn make_service(router: &ReplicaRouter) -> ContractService {
    ContractService::new(router.write_pool().clone(), router.read_pool().clone())
}

pub async fn generate_contract(req: HttpRequest, router: web::Data<ReplicaRouter>, body: web::Json<GenerateContractRequest>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).generate(user_id, &body).await {
        Ok(c) => HttpResponse::Created().json(serde_json::json!({"contract": c, "message": "Both parties must sign before deal proceeds."})),
        Err(e) => error_response(e),
    }
}

pub async fn sign_contract(req: HttpRequest, router: web::Data<ReplicaRouter>, path: web::Path<i64>, body: web::Json<SignContractRequest>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).sign(user_id, path.into_inner(), &body).await {
        Ok(c) => HttpResponse::Ok().json(serde_json::json!({"contract": c, "message": format!("Signed. Status: {}", c.status)})),
        Err(e) => error_response(e),
    }
}

pub async fn get_contract(req: HttpRequest, router: web::Data<ReplicaRouter>, path: web::Path<i64>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    let svc = make_service(&router);
    match svc.get_by_id(path.into_inner(), user_id).await {
        Ok(c) => HttpResponse::Ok().json(c),
        Err(e) => error_response(e),
    }
}

pub async fn get_contract_by_deal_room(req: HttpRequest, router: web::Data<ReplicaRouter>, path: web::Path<i64>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).get_by_deal_room(path.into_inner(), user_id).await {
        Ok(c) => HttpResponse::Ok().json(c),
        Err(e) => error_response(e),
    }
}

pub async fn request_revision(req: HttpRequest, router: web::Data<ReplicaRouter>, path: web::Path<i64>, body: web::Json<RequestRevisionBody>) -> impl Responder {
    let user_id = match extract_user_id(&req) { Ok(id) => id, Err(r) => return r };
    match make_service(&router).request_revision(user_id, path.into_inner(), &body).await {
        Ok(rev) => HttpResponse::Created().json(serde_json::json!({"revision": rev})),
        Err(e) => error_response(e),
    }
}

pub async fn list_templates(router: web::Data<ReplicaRouter>, query: web::Query<TemplateListQuery>) -> impl Responder {
    match make_service(&router).list_templates(&query).await {
        Ok((templates, total_count)) => HttpResponse::Ok().json(serde_json::json!({"templates": templates, "total": total_count})),
        Err(e) => error_response(e),
    }
}
