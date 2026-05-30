//! Referral HTTP Handlers

use actix_web::{web, HttpRequest, HttpResponse, HttpMessage, Responder};
use sqlx::PgPool;
use log::{info, error};
use crate::models::*;
use crate::service::{ReferralService, ServiceError};

fn get_user_id(req: &HttpRequest) -> Option<i64> {
    let claims = req.extensions().get::<auth_service::token::Claims>()?.clone();
    claims.sub.parse::<i64>().ok()
}

pub async fn create_code(
    pool: web::Data<PgPool>,
    body: web::Json<CreateCodeRequest>,
    req: HttpRequest,
) -> impl Responder {
    let user_id = match get_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish(),
    };

    // Verify the persona belongs to the requesting user
    let owns_persona: bool = match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM personas WHERE id = $1 AND user_id = $2)"
    )
    .bind(body.persona_id)
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await {
        Ok(v) => v,
        Err(_) => return HttpResponse::InternalServerError().finish(),
    };

    if !owns_persona {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You do not own this persona"
        }));
    }

    let service = ReferralService::new(pool.get_ref().clone());

    match service.create_code(body.persona_id, &body.code).await {
        Ok(response) => {
            info!("Created referral code {} for persona {}", body.code, body.persona_id);
            HttpResponse::Ok().json(response)
        }
        Err(ServiceError::CodeExists) => {
            HttpResponse::Conflict().json(serde_json::json!({
                "error": "Code already exists"
            }))
        }
        Err(ServiceError::AlreadyHasCode) => {
            HttpResponse::Conflict().json(serde_json::json!({
                "error": "Persona already has a referral code"
            }))
        }
        Err(ServiceError::InvalidCode(msg)) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": msg
            }))
        }
        Err(e) => {
            error!("Failed to create code: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn record_referral(
    pool: web::Data<PgPool>,
    body: web::Json<RecordReferralRequest>,
) -> impl Responder {
    let service = ReferralService::new(pool.get_ref().clone());
    
    match service.record_referral(
        body.new_persona_id,
        &body.referral_code,
        body.mint_amount_wei.as_deref(),
    ).await {
        Ok(()) => {
            info!("Recorded referral for persona {}", body.new_persona_id);
            HttpResponse::Ok().json(serde_json::json!({
                "success": true
            }))
        }
        Err(ServiceError::CodeNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Invalid referral code"
            }))
        }
        Err(ServiceError::SelfReferral) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Cannot refer yourself"
            }))
        }
        Err(ServiceError::AlreadyReferred) => {
            HttpResponse::Conflict().json(serde_json::json!({
                "error": "Persona already has a referrer"
            }))
        }
        Err(e) => {
            error!("Failed to record referral: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn get_stats(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> impl Responder {
    let persona_id = path.into_inner();
    let service = ReferralService::new(pool.get_ref().clone());
    
    match service.get_stats(persona_id).await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(e) => {
            error!("Failed to get stats: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn get_leaderboard(
    pool: web::Data<PgPool>,
    query: web::Query<LeaderboardQuery>,
) -> impl Responder {
    let limit = query.limit.unwrap_or(10).min(100);
    let service = ReferralService::new(pool.get_ref().clone());
    
    match service.get_leaderboard(limit).await {
        Ok(entries) => HttpResponse::Ok().json(serde_json::json!({
            "leaderboard": entries
        })),
        Err(e) => {
            error!("Failed to get leaderboard: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn validate_code(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    let code = path.into_inner();
    let service = ReferralService::new(pool.get_ref().clone());
    
    match service.validate_code(&code).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => {
            error!("Failed to validate code: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[derive(serde::Deserialize)]
pub struct LeaderboardQuery {
    pub limit: Option<i32>,
}
