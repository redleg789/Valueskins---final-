//! Waitlist HTTP Handlers

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use sqlx::PgPool;
use log::{info, error};
use crate::models::*;
use crate::service::{WaitlistService, ServiceError};

pub async fn join_waitlist(pool: web::Data<PgPool>, body: web::Json<JoinWaitlistRequest>, req: HttpRequest) -> impl Responder {
    let service = WaitlistService::new(pool.get_ref().clone());
    let ip = req.connection_info().realip_remote_addr().map(|s| s.to_string());
    let ua = req.headers().get("user-agent").and_then(|h| h.to_str().ok()).map(|s| s.to_string());
    
    match service.join(body.into_inner(), ip.as_deref(), ua.as_deref()).await {
        Ok(response) => {
            info!("New waitlist signup, position {}", response.position);
            HttpResponse::Created().json(response)
        }
        Err(ServiceError::AlreadyExists(pos)) => {
            HttpResponse::Conflict().json(serde_json::json!({ "error": "Already on waitlist", "position": pos }))
        }
        Err(e) => {
            error!("Waitlist join error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn get_position(pool: web::Data<PgPool>, query: web::Query<PositionQuery>) -> impl Responder {
    let service = WaitlistService::new(pool.get_ref().clone());
    match service.get_position(&query.email).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Email not found" })),
        Err(e) => { error!("Position lookup error: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

pub async fn get_stats(pool: web::Data<PgPool>) -> impl Responder {
    let service = WaitlistService::new(pool.get_ref().clone());
    match service.get_stats().await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(e) => { error!("Stats error: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

#[derive(serde::Deserialize)]
pub struct PositionQuery { pub email: String }
