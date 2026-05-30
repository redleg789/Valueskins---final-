//! Event HTTP Handlers

use actix_web::{web, HttpRequest, HttpResponse, HttpMessage, Responder};
use sqlx::PgPool;
use log::{info, error};
use crate::models::*;
use crate::service::{EventService, ServiceError};

// ── Helper Functions ───────────────────────────────────────────────────

fn get_user_info(req: &HttpRequest) -> Option<(i64, Option<i64>)> {
    let claims = req.extensions().get::<auth_service::token::Claims>()?.clone();
    let user_id: i64 = claims.sub.parse().ok()?;
    Some((user_id, claims.persona_id))
}

// ── Event Management ───────────────────────────────────────────────────

/// POST /events
pub async fn create_event(
    pool: web::Data<PgPool>,
    body: web::Json<CreateEventRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let svc = EventService::new(pool.get_ref().clone());
    match svc.create_event(user_id, body.into_inner()).await {
        Ok(id) => {
            info!("Created event {}", id);
            HttpResponse::Created().json(serde_json::json!({ "event_id": id }))
        }
        Err(ServiceError::RequiresValueSkin) => {
            HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Create a ValueSkin to host events."
            }))
        }
        Err(e) => {
            error!("create_event error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /events/{id}
pub async fn get_event(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let id = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.get_event(id, user_id).await {
        Ok(event) => HttpResponse::Ok().json(event),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(e) => {
            error!("get_event error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /events/{id}/register
pub async fn register_event(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<RegisterEventRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let event_id = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.register_event(event_id, user_id, body.status.clone()).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Registered successfully" })),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(e) => {
            error!("register_event error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// DELETE /events/{id}/register
pub async fn unregister_event(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let event_id = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.unregister_event(event_id, user_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Unregistered successfully" })),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(e) => {
            error!("unregister_event error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /events/{id}/interactions
pub async fn record_interaction(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<RecordEventInteractionRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let event_id = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.record_interaction(event_id, user_id, body.into_inner()).await {
        Ok(_) => HttpResponse::Accepted().json(serde_json::json!({ "recorded": true })),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(ServiceError::Forbidden) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_event_interaction"
        })),
        Err(e) => {
            error!("record_interaction error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /events/{id}/tags
pub async fn list_event_tags(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let event_id = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.get_event_tags(event_id, user_id).await {
        Ok(tags) => HttpResponse::Ok().json(serde_json::json!({ "tags": tags })),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(e) => {
            error!("list_event_tags error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /events/{id}/tags
pub async fn create_event_tag(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<CreateEventTagRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let event_id = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.add_event_tag(event_id, user_id, body.into_inner()).await {
        Ok(tag) => HttpResponse::Created().json(tag),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(ServiceError::Forbidden) => HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Event host can only tag separate ValueSkin holders"
        })),
        Err(e) => {
            error!("create_event_tag error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /events/{id}/tags/{tag_id}/approve
pub async fn approve_event_tag(
    pool: web::Data<PgPool>,
    path: web::Path<(i64, i64)>,
    body: web::Json<UpdateEventTagDecisionRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let (event_id, tag_id) = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.decision_on_event_tag(event_id, tag_id, user_id, true, body.reason.clone()).await {
        Ok(tag) => HttpResponse::Ok().json(tag),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(ServiceError::Forbidden) => HttpResponse::Forbidden().finish(),
        Err(e) => {
            error!("approve_event_tag error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /events/{id}/tags/{tag_id}/reject
pub async fn reject_event_tag(
    pool: web::Data<PgPool>,
    path: web::Path<(i64, i64)>,
    body: web::Json<UpdateEventTagDecisionRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let (event_id, tag_id) = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.decision_on_event_tag(event_id, tag_id, user_id, false, body.reason.clone()).await {
        Ok(tag) => HttpResponse::Ok().json(tag),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(ServiceError::Forbidden) => HttpResponse::Forbidden().finish(),
        Err(e) => {
            error!("reject_event_tag error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// DELETE /events/{id}/tags/{tag_id}
pub async fn delete_event_tag(
    pool: web::Data<PgPool>,
    path: web::Path<(i64, i64)>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let (event_id, tag_id) = path.into_inner();
    let svc = EventService::new(pool.get_ref().clone());

    match svc.remove_event_tag(event_id, tag_id, user_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "removed": true })),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(ServiceError::Forbidden) => HttpResponse::Forbidden().finish(),
        Err(e) => {
            error!("delete_event_tag error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// ── Explorer Interface ────────────────────────────────────────────────

/// PUT /explorer/location
pub async fn update_location(
    pool: web::Data<PgPool>,
    body: web::Json<UpdateLocationRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let svc = EventService::new(pool.get_ref().clone());
    match svc.update_preferred_city(user_id, body.preferred_city.clone()).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Location updated successfully" })),
        Err(e) => {
            error!("update_location error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /explorer/home
pub async fn get_explorer_home(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let svc = EventService::new(pool.get_ref().clone());
    match svc.get_explorer_home(user_id).await {
        Ok(home_data) => HttpResponse::Ok().json(home_data),
        Err(e) => {
            error!("get_explorer_home error: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}
