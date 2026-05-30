//! Marketplace HTTP Handlers

use actix_web::{web, HttpRequest, HttpResponse, HttpMessage, Responder};
use sqlx::PgPool;
use log::{info, error};
use crate::models::*;
use crate::service::{MarketplaceService, ServiceError};
use shared::idempotency::IdempotencyService;
use serde_json::Value;

#[derive(Debug)]
enum IdempotencyKeyError {
    Missing,
    Invalid,
}

fn parse_idempotency_key(req: &HttpRequest) -> Result<String, IdempotencyKeyError> {
    let raw = req
        .headers()
        .get("Idempotency-Key")
        .and_then(|h| h.to_str().ok())
        .ok_or(IdempotencyKeyError::Missing)?;

    let trimmed = raw.trim();
    if trimmed.is_empty()
        || trimmed.len() > 128
        || !trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(IdempotencyKeyError::Invalid);
    }

    Ok(trimmed.to_owned())
}

async fn check_cached_idempotent_response(
    idempotency: &IdempotencyService,
    key: &str,
    endpoint: &str,
) -> Result<Option<Value>, HttpResponse> {
    match idempotency.check(key, endpoint).await {
        Ok(cached) => Ok(cached),
        Err(e) => {
            error!("Idempotency check failed: {:?}", e);
            Err(HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "Service temporarily unavailable"
            })))
        }
    }
}

async fn store_idempotent_response(
    idempotency: &IdempotencyService,
    key: &str,
    endpoint: &str,
    user_id: i64,
    status: i16,
    body: &Value,
) {
    if let Err(e) = idempotency.store(key, endpoint, user_id, status, body).await {
        error!("Idempotency store failed: {:?}", e);
    }
}

/// GET /marketplace/opportunities
pub async fn list_opportunities(
    pool: web::Data<PgPool>,
    query: web::Query<OpportunityFilters>,
    req: HttpRequest,
) -> impl Responder {
    let service = MarketplaceService::new(pool.get_ref().clone());
    let persona_id = get_persona_id(&req);

    match service.list_opportunities(query.into_inner(), persona_id).await {
        Ok(opportunities) => {
            let count = opportunities.len();
            HttpResponse::Ok().json(serde_json::json!({
                "opportunities": opportunities,
                "count": count
            }))
        }
        Err(e) => {
            error!("Failed to list opportunities: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /marketplace/opportunities/{id}
pub async fn get_opportunity(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let id = path.into_inner();
    let service = MarketplaceService::new(pool.get_ref().clone());
    let persona_id = get_persona_id(&req);

    match service.get_opportunity(id, persona_id).await {
        Ok(opp) => HttpResponse::Ok().json(opp),
        Err(ServiceError::NotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Opportunity not found"
            }))
        }
        Err(e) => {
            error!("Failed to get opportunity: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /marketplace/opportunities (Brands only)
pub async fn create_opportunity(
    pool: web::Data<PgPool>,
    idempotency: web::Data<IdempotencyService>,
    body: web::Json<CreateOpportunityRequest>,
    req: HttpRequest,
) -> impl Responder {
    let service = MarketplaceService::new(pool.get_ref().clone());
    let endpoint = "/marketplace/opportunities";
    let key = match parse_idempotency_key(&req) {
        Ok(v) => v,
        Err(IdempotencyKeyError::Missing) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is required"
            }))
        }
        Err(IdempotencyKeyError::Invalid) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is invalid"
            }))
        }
    };

    let (brand_id, brand_user_id) = match get_brand_info(&req, pool.get_ref()).await {
        Some(b) => b,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Brand authentication required"
        })),
    };

    if let Some(cached) = match check_cached_idempotent_response(idempotency.get_ref(), &key, endpoint).await {
        Ok(cached) => cached,
        Err(resp) => return resp,
    } {
        return HttpResponse::Ok().json(cached);
    }

    match service.create_opportunity(brand_id, brand_user_id, body.into_inner()).await {
        Ok(id) => {
            info!("Created opportunity {}", id);
            let response_body = serde_json::json!({
                "opportunity_id": id
            });
            store_idempotent_response(idempotency.get_ref(), &key, endpoint, brand_user_id, 201, &response_body).await;
            HttpResponse::Created().json(response_body)
        }
        Err(ServiceError::BarterViolation(reason)) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid compensation configuration",
                "reason": reason
            }))
        }
        Err(e) => {
            error!("Failed to create opportunity: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /marketplace/applications
pub async fn apply_to_opportunity(
    pool: web::Data<PgPool>,
    idempotency: web::Data<IdempotencyService>,
    body: web::Json<ApplyRequest>,
    req: HttpRequest,
) -> impl Responder {
    let service = MarketplaceService::new(pool.get_ref().clone());
    let endpoint = "/marketplace/applications";
    let key = match parse_idempotency_key(&req) {
        Ok(v) => v,
        Err(IdempotencyKeyError::Missing) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is required"
            }))
        }
        Err(IdempotencyKeyError::Invalid) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is invalid"
            }))
        }
    };

    let (user_id, persona_id) = match get_user_info(&req) {
        Some(info) => info,
        None => return HttpResponse::Unauthorized().finish(),
    };

    if let Some(cached) = match check_cached_idempotent_response(idempotency.get_ref(), &key, endpoint).await {
        Ok(cached) => cached,
        Err(resp) => return resp,
    } {
        return HttpResponse::Ok().json(cached);
    }

    match service.apply(persona_id.unwrap_or(body.persona_id), user_id, body.into_inner()).await {
        Ok(id) => {
            info!("Created application {}", id);

            // ── Trigger: notify brand of new application ──────────────────
            // Fire-and-forget notification. In production: Kafka + async worker.
            let _ = sqlx::query(
                "INSERT INTO notification_queue (recipient_user_id, event_type, payload, is_sent) VALUES ($1, 'new_application', $2, FALSE)"
            )
            .bind(user_id)
            .bind(serde_json::json!({ "application_id": id }))
            .execute(pool.get_ref())
            .await.ok();

            let response_body = serde_json::json!({
                "application_id": id
            });
            store_idempotent_response(idempotency.get_ref(), &key, endpoint, user_id, 201, &response_body).await;
            HttpResponse::Created().json(response_body)
        }
        Err(ServiceError::NotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Opportunity not found"
            }))
        }
        Err(ServiceError::OpportunityClosed) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Opportunity is no longer accepting applications"
            }))
        }
        Err(ServiceError::OpportunityExpired) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Opportunity has expired"
            }))
        }
        Err(ServiceError::InsufficientLevel) => {
            HttpResponse::Forbidden().json(serde_json::json!({
                "error": "You do not meet the required level for this opportunity"
            }))
        }
        Err(ServiceError::AlreadyApplied) => {
            HttpResponse::Conflict().json(serde_json::json!({
                "error": "You have already applied to this opportunity"
            }))
        }
        Err(ServiceError::GatingBlocked(reason)) => {
            HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Campaign gating requirements not met",
                "reason": reason
            }))
        }
        Err(ServiceError::BarterViolation(reason)) => {
            HttpResponse::Forbidden().json(serde_json::json!({
                "error": "You must opt into barter deals before applying to barter/exposure opportunities",
                "reason": reason
            }))
        }
        Err(e) => {
            error!("Failed to apply: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /marketplace/applications/mine
pub async fn get_my_applications(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = match get_persona_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Authentication required"
        })),
    };

    let apps = sqlx::query_as::<_, ApplicationRow>(
        r#"
        SELECT a.id, a.opportunity_id, o.title as opportunity_title,
               a.persona_id, a.pitch, a.status, a.created_at
        FROM opportunity_applications a
        JOIN opportunities o ON a.opportunity_id = o.id
        WHERE a.persona_id = $1
        ORDER BY a.created_at DESC
        "#
    )
    .bind(persona_id)
    .fetch_all(pool.get_ref())
    .await;

    match apps {
        Ok(apps) => HttpResponse::Ok().json(serde_json::json!({
            "applications": apps
        })),
        Err(e) => {
            error!("Failed to get applications: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /brands/opportunities/{id}/applications (Brand only)
pub async fn get_opportunity_applications(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let opportunity_id = path.into_inner();

    // Verify caller is the brand that owns this opportunity
    let (brand_id, brand_user_id) = match get_brand_info(&req, pool.get_ref()).await {
        Some(b) => b,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Brand authentication required"
        })),
    };

    // Verify this opportunity belongs to this brand
    let opp_brand: Option<i64> = sqlx::query_scalar(
        "SELECT brand_user_id FROM opportunities WHERE id = $1"
    )
    .bind(opportunity_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    if opp_brand != Some(brand_user_id) {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You do not own this opportunity"
        }));
    }

    let service = MarketplaceService::new(pool.get_ref().clone());

    match service.get_opportunity_applications(opportunity_id).await {
        Ok(apps) => HttpResponse::Ok().json(serde_json::json!({
            "applications": apps
        })),
        Err(e) => {
            error!("Failed to get applications: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /brands/applications/accept
pub async fn accept_application(
    pool: web::Data<PgPool>,
    idempotency: web::Data<IdempotencyService>,
    body: web::Json<AcceptApplicationRequest>,
    req: HttpRequest,
) -> impl Responder {
    let endpoint = "/brands/applications/accept";
    let key = match parse_idempotency_key(&req) {
        Ok(v) => v,
        Err(IdempotencyKeyError::Missing) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is required"
            }))
        }
        Err(IdempotencyKeyError::Invalid) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is invalid"
            }))
        }
    };

    let (_brand_id, brand_user_id) = match get_brand_info(&req, pool.get_ref()).await {
        Some(b) => b,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Brand authentication required"
        })),
    };

    if let Some(cached) = match check_cached_idempotent_response(idempotency.get_ref(), &key, endpoint).await {
        Ok(cached) => cached,
        Err(resp) => return resp,
    } {
        return HttpResponse::Ok().json(cached);
    }

    // Verify this opportunity belongs to this brand
    let opp_brand: Option<i64> = sqlx::query_scalar(
        "SELECT brand_user_id FROM opportunities WHERE id = $1"
    )
    .bind(body.opportunity_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    if opp_brand != Some(brand_user_id) {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You do not own this opportunity"
        }));
    }

    let service = MarketplaceService::new(pool.get_ref().clone());

    match service.accept_application(body.opportunity_id, body.persona_id).await {
        Ok(()) => {
            info!("Accepted application for opportunity {}", body.opportunity_id);
            let response_body = serde_json::json!({
                "success": true
            });
            store_idempotent_response(idempotency.get_ref(), &key, endpoint, brand_user_id, 200, &response_body).await;
            HttpResponse::Ok().json(response_body)
        }
        Err(e) => {
            error!("Failed to accept application: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /brands/deals/complete
pub async fn complete_deal(
    pool: web::Data<PgPool>,
    idempotency: web::Data<IdempotencyService>,
    body: web::Json<CompleteDealRequest>,
    req: HttpRequest,
) -> impl Responder {
    let endpoint = "/brands/deals/complete";
    let key = match parse_idempotency_key(&req) {
        Ok(v) => v,
        Err(IdempotencyKeyError::Missing) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is required"
            }))
        }
        Err(IdempotencyKeyError::Invalid) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Idempotency-Key header is invalid"
            }))
        }
    };

    let (_brand_id, brand_user_id) = match get_brand_info(&req, pool.get_ref()).await {
        Some(b) => b,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Brand authentication required"
        })),
    };

    if let Some(cached) = match check_cached_idempotent_response(idempotency.get_ref(), &key, endpoint).await {
        Ok(cached) => cached,
        Err(resp) => return resp,
    } {
        return HttpResponse::Ok().json(cached);
    }

    // Verify ownership
    let opp_brand: Option<i64> = sqlx::query_scalar(
        "SELECT brand_user_id FROM opportunities WHERE id = $1"
    )
    .bind(body.opportunity_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    if opp_brand != Some(brand_user_id) {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You do not own this opportunity"
        }));
    }

    let service = MarketplaceService::new(pool.get_ref().clone());

    match service.complete_deal(body.opportunity_id).await {
        Ok(()) => {
            info!("Completed deal for opportunity {}", body.opportunity_id);
            let response_body = serde_json::json!({
                "success": true
            });
            store_idempotent_response(idempotency.get_ref(), &key, endpoint, brand_user_id, 200, &response_body).await;
            HttpResponse::Ok().json(response_body)
        }
        Err(ServiceError::InvalidStatus) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Opportunity must be filled before completing"
            }))
        }
        Err(e) => {
            error!("Failed to complete deal: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /marketplace/stats
pub async fn get_stats(pool: web::Data<PgPool>) -> impl Responder {
    let service = MarketplaceService::new(pool.get_ref().clone());

    match service.get_stats().await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(e) => {
            error!("Failed to get stats: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// ── Helper types ───────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct CompleteDealRequest {
    pub opportunity_id: i64,
}

#[derive(sqlx::FromRow, serde::Serialize)]
pub struct ApplicationRow {
    pub id: i64,
    pub opportunity_id: i64,
    pub opportunity_title: String,
    pub persona_id: i64,
    pub pitch: Option<String>,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ── Deal Room Handlers ──────────────────────────────────────────────────

/// POST /deal-rooms  — brand opens a deal room (must include full brief)
pub async fn open_deal_room(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::OpenDealRoomRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.open_deal_room(user_id, body.into_inner()).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({ "deal_room_id": id })),
        Err(crate::service::ServiceError::CreatorInQuietMode) =>
            HttpResponse::Conflict().json(serde_json::json!({ "error": "Creator is in quiet mode during an active negotiation" })),
        Err(e) => { error!("open_deal_room: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /deal-rooms  — list all deal rooms for the authenticated user
pub async fn list_deal_rooms(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, persona_id) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.list_deal_rooms(user_id, persona_id).await {
        Ok(rooms) => HttpResponse::Ok().json(serde_json::json!({ "deal_rooms": rooms })),
        Err(e) => { error!("list_deal_rooms: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /deal-rooms/{id}/offers  — make an offer in a deal room
pub async fn make_offer(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::models::MakeOfferRequest>,
    req: HttpRequest,
) -> impl Responder {
    let deal_room_id = path.into_inner();
    let (user_id, persona_id) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let extensions = req.extensions();
    let claims = match extensions.get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().finish(),
    };
    drop(extensions);
    let made_by = if claims.role == "brand" { "brand" } else { "creator" };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.make_offer(deal_room_id, made_by, user_id, persona_id, body.into_inner()).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({ "offer_round_id": id })),
        Err(crate::service::ServiceError::OfferBelowFloor) =>
            HttpResponse::Forbidden().json(serde_json::json!({ "error": "Offer is below creator's minimum floor — repeated lowballing has triggered auto-block" })),
        Err(crate::service::ServiceError::DealRoomClosed) =>
            HttpResponse::Gone().json(serde_json::json!({ "error": "Deal room is no longer active" })),
        Err(e) => { error!("make_offer: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /deal-rooms/offers/{id}/respond  — accept, reject, or counter an offer
pub async fn respond_to_offer(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::models::RespondOfferRequest>,
    req: HttpRequest,
) -> impl Responder {
    let offer_round_id = path.into_inner();
    let extensions = req.extensions();
    let claims = match extensions.get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().finish(),
    };
    drop(extensions);
    let responder_role = if claims.role == "brand" { "brand" } else { "creator" };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.respond_to_offer(offer_round_id, responder_role, body.into_inner()).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "success": true })),
        Err(crate::service::ServiceError::AlreadyResponded) =>
            HttpResponse::Conflict().json(serde_json::json!({ "error": "This offer round has already been responded to" })),
        Err(e) => { error!("respond_to_offer: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /deal-rooms/{id}/soft-hold  — brand reserves creator slot
pub async fn create_soft_hold(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::models::CreateSoftHoldRequest>,
    req: HttpRequest,
) -> impl Responder {
    let deal_room_id = path.into_inner();
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    let mut req_body = body.into_inner();
    req_body.deal_room_id = deal_room_id;
    match svc.create_soft_hold(user_id, req_body).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({ "soft_hold_id": id })),
        Err(crate::service::ServiceError::CreatorAlreadyHeld) =>
            HttpResponse::Conflict().json(serde_json::json!({ "error": "Creator already has an active soft hold from another brand" })),
        Err(e) => { error!("create_soft_hold: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /deal-rooms/{id}/checklist  — expectation checklist before closing
pub async fn get_checklist(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let deal_room_id = path.into_inner();
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    HttpResponse::Ok().json(svc.get_expectation_checklist(deal_room_id))
}

/// POST /creators/me/price-band  — set public price band + private exact range
pub async fn set_price_band(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::SetPriceBandRequest>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = match get_persona_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.set_price_band(persona_id, body.into_inner()).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "success": true })),
        Err(e) => { error!("set_price_band: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /creators/me/auto-escalation  — set auto-block floor
pub async fn set_auto_escalation(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::SetAutoEscalationRequest>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = match get_persona_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.set_auto_escalation(persona_id, body.into_inner()).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "success": true })),
        Err(e) => { error!("set_auto_escalation: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /creators/me/energy  — creator marks burnout/limited/available
pub async fn set_energy_state(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::SetEnergyStateRequest>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = match get_persona_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.set_energy_state(persona_id, body.into_inner()).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "success": true })),
        Err(e) => { error!("set_energy_state: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /creators/me/deliverables  — upload proof-of-work
pub async fn upload_deliverable(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::UploadDeliverableRequest>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = match get_persona_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.upload_deliverable(persona_id, body.into_inner()).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({ "deliverable_id": id })),
        Err(e) => { error!("upload_deliverable: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /testimonials  — leave a contextual testimonial after deal
pub async fn submit_testimonial(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::SubmitTestimonialRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.submit_testimonial(user_id, body.into_inner()).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({ "testimonial_id": id })),
        Err(e) => { error!("submit_testimonial: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /deal-rooms/{id}/escrow  — set up advance/milestone/completion escrow
pub async fn create_escrow_stages(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::models::CreateEscrowStagesRequest>,
    req: HttpRequest,
) -> impl Responder {
    let deal_room_id = path.into_inner();
    let _ = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    let mut r = body.into_inner();
    r.deal_room_id = deal_room_id;
    match svc.create_escrow_stages(r).await {
        Ok(()) => HttpResponse::Created().json(serde_json::json!({ "success": true })),
        Err(crate::service::ServiceError::BarterViolation(reason)) =>
            HttpResponse::BadRequest().json(serde_json::json!({ "error": reason })),
        Err(e) => { error!("create_escrow_stages: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /deal-rooms/{id}/repeat  — one-click repeat collaboration
pub async fn repeat_collab(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let original_id = path.into_inner();
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.create_repeat_collab(user_id, crate::models::RepeatCollabRequest { original_room_id: original_id }).await {
        Ok(new_id) => HttpResponse::Created().json(serde_json::json!({ "new_deal_room_id": new_id })),
        Err(crate::service::ServiceError::NotFound) =>
            HttpResponse::NotFound().json(serde_json::json!({ "error": "Original deal room not found" })),
        Err(e) => { error!("repeat_collab: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /creators/me/calendar  — set availability slot
pub async fn set_calendar_slot(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::SetCalendarSlotRequest>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = match get_persona_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.set_calendar_slot(persona_id, body.into_inner()).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "success": true })),
        Err(e) => { error!("set_calendar_slot: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /personas/{id}/trust  — public trust score (no exact prices exposed)
pub async fn get_trust_score(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = path.into_inner();
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.get_trust_score(persona_id).await {
        Ok(score) => HttpResponse::Ok().json(score),
        Err(crate::service::ServiceError::NotFound) =>
            HttpResponse::NotFound().json(serde_json::json!({ "error": "Trust score not found" })),
        Err(e) => { error!("get_trust_score: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /marketplace/scan/{persona_id}  — brand scans creator profile (throttled)
pub async fn scan_creator(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let persona_id = path.into_inner();
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::service::DealRoomService::new(pool.get_ref().clone());
    match svc.check_and_record_scan(user_id, persona_id).await {
        Ok(true)  => HttpResponse::Ok().json(serde_json::json!({ "allowed": true })),
        Ok(false) => HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Weekly discovery limit reached. Complete more deals to unlock higher quota."
        })),
        Err(e) => { error!("scan_creator: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

// ── JWT claim extraction helpers ───────────────────────────────────────

/// Extracts persona_id from the JWT claims stored in request extensions.
fn get_persona_id(req: &HttpRequest) -> Option<i64> {
    let extensions = req.extensions();
    let claims = extensions.get::<auth_service::token::Claims>()?;
    claims.persona_id
}

/// Extracts (user_id, persona_id) from JWT claims.
fn get_user_info(req: &HttpRequest) -> Option<(i64, Option<i64>)> {
    let extensions = req.extensions();
    let claims = extensions.get::<auth_service::token::Claims>()?;
    let user_id: i64 = claims.sub.parse().ok()?;
    Some((user_id, claims.persona_id))
}

/// Extracts brand info from JWT claims. Returns (brand_id, brand_user_id).
/// Looks up the brands table to find the brand associated with this user.
async fn get_brand_info(req: &HttpRequest, pool: &PgPool) -> Option<(Option<i64>, i64)> {
    let extensions = req.extensions();
    let claims = extensions.get::<auth_service::token::Claims>()?;

    if claims.role != "brand" {
        return None;
    }

    let user_id: i64 = claims.sub.parse().ok()?;

    // Look up brand_id for this user
    let brand_id: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM brands WHERE owner_user_id = $1 AND is_active = TRUE LIMIT 1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()?;

    Some((brand_id, user_id))
}

// ────────────────────────────────────────────────────────────────
// ValueSkin Hide / Delete Handlers
// ────────────────────────────────────────────────────────────────

/// POST /creators/me/valueskins/{id}/hide
/// Temporarily hide a ValueSkin (reversible)
pub async fn hide_valueskin(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
    req: HttpRequest,
) -> impl Responder {
    let sticker_id = path.into_inner();
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    // Verify ownership and hide
    match sqlx::query(
        r#"
        UPDATE user_stickers
        SET is_hidden = TRUE
        WHERE id = $1 AND user_id = $2
        "#
    )
    .bind(&sticker_id)
    .bind(user_id)
    .execute(pool.get_ref())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "ValueSkin not found or does not belong to you"
                }))
            } else {
                info!("Hid ValueSkin {} for user {}", sticker_id, user_id);
                HttpResponse::Ok().json(serde_json::json!({
                    "message": "ValueSkin hidden",
                    "valueskin_id": sticker_id
                }))
            }
        }
        Err(e) => {
            error!("Failed to hide ValueSkin: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /creators/me/valueskins/{id}/unhide
/// Restore a hidden ValueSkin
pub async fn unhide_valueskin(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
    req: HttpRequest,
) -> impl Responder {
    let sticker_id = path.into_inner();
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    match sqlx::query(
        r#"
        UPDATE user_stickers
        SET is_hidden = FALSE
        WHERE id = $1 AND user_id = $2
        "#
    )
    .bind(&sticker_id)
    .bind(user_id)
    .execute(pool.get_ref())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "ValueSkin not found or does not belong to you"
                }))
            } else {
                info!("Unhid ValueSkin {} for user {}", sticker_id, user_id);
                HttpResponse::Ok().json(serde_json::json!({
                    "message": "ValueSkin restored",
                    "valueskin_id": sticker_id
                }))
            }
        }
        Err(e) => {
            error!("Failed to unhide ValueSkin: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// ── Barter Preference Handlers ─────────────────────────────────────────

/// GET /creators/me/barter — read current barter preference
pub async fn get_barter_preference(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::barter_service::BarterService::new(pool.get_ref().clone());
    match svc.get_barter_preference(user_id).await {
        Ok(willing) => HttpResponse::Ok().json(crate::models::BarterPreferenceResponse {
            user_id,
            willing_to_barter: willing,
        }),
        Err(crate::barter_service::BarterError::NotFound) =>
            HttpResponse::NotFound().json(serde_json::json!({ "error": "User not found" })),
        Err(e) => { error!("get_barter_preference: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /creators/me/barter — toggle barter preference
pub async fn set_barter_preference(
    pool: web::Data<PgPool>,
    body: web::Json<crate::models::SetBarterPreferenceRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::barter_service::BarterService::new(pool.get_ref().clone());
    match svc.set_barter_preference(user_id, body.willing_to_barter).await {
        Ok(willing) => HttpResponse::Ok().json(crate::models::BarterPreferenceResponse {
            user_id,
            willing_to_barter: willing,
        }),
        Err(crate::barter_service::BarterError::NotEligible { reason }) =>
            HttpResponse::Forbidden().json(serde_json::json!({ "error": reason })),
        Err(crate::barter_service::BarterError::NotFound) =>
            HttpResponse::NotFound().json(serde_json::json!({ "error": "User not found" })),
        Err(e) => { error!("set_barter_preference: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /creators/barter-willing — list creators willing to barter (for brands)
pub async fn list_barter_willing_creators(
    pool: web::Data<PgPool>,
    query: web::Query<BarterWillingQuery>,
) -> impl Responder {
    let svc = crate::barter_service::BarterService::new(pool.get_ref().clone());
    match svc.list_barter_willing_creators(query.profession_id, query.limit.unwrap_or(20), query.offset.unwrap_or(0)).await {
        Ok(user_ids) => HttpResponse::Ok().json(serde_json::json!({
            "user_ids": user_ids,
            "count": user_ids.len()
        })),
        Err(e) => { error!("list_barter_willing_creators: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

#[derive(serde::Deserialize)]
pub struct BarterWillingQuery {
    pub profession_id: Option<i64>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// DELETE /creators/me/valueskins/{id}
/// Permanently delete a ValueSkin (no refund, irreversible)
pub async fn delete_valueskin(
    pool: web::Data<PgPool>,
    path: web::Path<String>,
    req: HttpRequest,
) -> impl Responder {
    let sticker_id = path.into_inner();
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    // Soft delete: set deleted_at timestamp
    match sqlx::query(
        r#"
        UPDATE user_stickers
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        "#
    )
    .bind(&sticker_id)
    .bind(user_id)
    .execute(pool.get_ref())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "ValueSkin not found, does not belong to you, or is already deleted"
                }))
            } else {
                info!("Deleted ValueSkin {} for user {}", sticker_id, user_id);
                HttpResponse::Ok().json(serde_json::json!({
                    "message": "ValueSkin permanently deleted — this cannot be undone",
                    "valueskin_id": sticker_id,
                    "refund": "No refund issued"
                }))
            }
        }
        Err(e) => {
            error!("Failed to delete ValueSkin: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// ════════════════════════════════════════════════════════════════
// GDPR Data Deletion Handlers
// ════════════════════════════════════════════════════════════════

/// POST /users/me/data-deletion  — request erasure of personal data
#[derive(serde::Deserialize)]
pub struct DataDeletionRequest {
    pub scope: Option<String>,
    pub reason: Option<String>,
}

pub async fn request_data_deletion(
    pool: web::Data<PgPool>,
    body: web::Json<DataDeletionRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::gdpr_service::GdprService::new(pool.get_ref().clone());
    let scope = body.scope.as_deref().unwrap_or("full");
    match svc.request_deletion(user_id, scope, body.reason.as_deref()).await {
        Ok(id) => HttpResponse::Accepted().json(serde_json::json!({
            "request_id": id,
            "message": "Deletion request received. Your data will be erased within 30 days as required by GDPR.",
            "scope": scope,
            "must_complete_by": chrono::Utc::now() + chrono::Duration::days(30)
        })),
        Err(crate::gdpr_service::GdprError::AlreadyRequested) =>
            HttpResponse::Conflict().json(serde_json::json!({
                "error": "You already have a pending data deletion request"
            })),
        Err(e) => { error!("request_data_deletion: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /users/me/data-deletion  — check deletion request status
pub async fn get_deletion_status(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::gdpr_service::GdprService::new(pool.get_ref().clone());
    match svc.get_deletion_status(user_id).await {
        Ok(Some(status)) => HttpResponse::Ok().json(status),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": "No deletion request found"
        })),
        Err(e) => { error!("get_deletion_status: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// DELETE /users/me/data-deletion  — cancel a pending request
pub async fn cancel_data_deletion(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::gdpr_service::GdprService::new(pool.get_ref().clone());
    match svc.cancel_deletion(user_id).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "message": "Deletion request cancelled" })),
        Err(crate::gdpr_service::GdprError::NotFound) =>
            HttpResponse::NotFound().json(serde_json::json!({ "error": "No pending deletion request found" })),
        Err(e) => { error!("cancel_data_deletion: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

// ════════════════════════════════════════════════════════════════
// Brand Verification Handlers
// ════════════════════════════════════════════════════════════════

/// POST /brands/verify  — brand submits verification request
pub async fn submit_brand_verification(
    pool: web::Data<PgPool>,
    body: web::Json<crate::brand_verification_service::SubmitVerificationRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::brand_verification_service::BrandVerificationService::new(pool.get_ref().clone());
    match svc.submit(user_id, body.into_inner()).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({
            "verification_id": id,
            "status": "pending",
            "message": "Verification submitted. Our team will review within 2-3 business days."
        })),
        Err(crate::brand_verification_service::BrandVerificationError::AlreadyVerified) =>
            HttpResponse::Conflict().json(serde_json::json!({ "error": "Brand is already verified" })),
        Err(crate::brand_verification_service::BrandVerificationError::AlreadyPending) =>
            HttpResponse::Conflict().json(serde_json::json!({ "error": "Verification request already pending or under review" })),
        Err(e) => { error!("submit_brand_verification: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /brands/verify  — brand checks their verification status
pub async fn get_brand_verification_status(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::brand_verification_service::BrandVerificationService::new(pool.get_ref().clone());
    match svc.get_status(user_id).await {
        Ok(Some(status)) => HttpResponse::Ok().json(status),
        Ok(None) => HttpResponse::Ok().json(serde_json::json!({
            "status": "not_submitted",
            "message": "No verification request submitted yet"
        })),
        Err(e) => { error!("get_brand_verification_status: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /admin/brands/verify  — admin: list pending verifications
#[derive(serde::Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn admin_list_brand_verifications(
    pool: web::Data<PgPool>,
    query: web::Query<PaginationQuery>,
    req: HttpRequest,
) -> impl Responder {
    let extensions = req.extensions();
    let claims = match extensions.get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().finish(),
    };
    drop(extensions);
    if claims.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required" }));
    }
    let svc = crate::brand_verification_service::BrandVerificationService::new(pool.get_ref().clone());
    let limit = query.limit.unwrap_or(20);
    let offset = query.offset.unwrap_or(0);
    match svc.list_pending(limit, offset).await {
        Ok(items) => {
            let count = items.len();
            HttpResponse::Ok().json(serde_json::json!({ "verifications": items, "count": count }))
        },
        Err(e) => { error!("admin_list_brand_verifications: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// POST /admin/brands/{user_id}/verify  — admin approves or rejects
pub async fn admin_review_brand_verification(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::brand_verification_service::ReviewVerificationRequest>,
    req: HttpRequest,
) -> impl Responder {
    let brand_user_id = path.into_inner();
    let extensions = req.extensions();
    let claims = match extensions.get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().finish(),
    };
    drop(extensions);
    if claims.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required" }));
    }
    let reviewer_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::brand_verification_service::BrandVerificationService::new(pool.get_ref().clone());
    match svc.review(brand_user_id, reviewer_id, body.into_inner()).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "success": true })),
        Err(crate::brand_verification_service::BrandVerificationError::NotFound) =>
            HttpResponse::NotFound().json(serde_json::json!({ "error": "No active verification request for this brand" })),
        Err(e) => { error!("admin_review_brand_verification: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

// ════════════════════════════════════════════════════════════════
// Creator Completeness Handlers
// ════════════════════════════════════════════════════════════════

/// GET /creators/me/completeness  — get or compute profile completeness
pub async fn get_my_completeness(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::completeness_service::CompletenessService::new(pool.get_ref().clone());
    match svc.compute_and_store(user_id).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => { error!("get_my_completeness: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /creators/{user_id}/completeness  — public score (for brands)
pub async fn get_creator_completeness(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> impl Responder {
    let user_id = path.into_inner();
    let svc = crate::completeness_service::CompletenessService::new(pool.get_ref().clone());
    match svc.get(user_id).await {
        Ok(Some(result)) => HttpResponse::Ok().json(serde_json::json!({
            "user_id": result.user_id,
            "completeness_score": result.completeness_score,
            "completeness_tier": result.completeness_tier,
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Not yet computed" })),
        Err(e) => { error!("get_creator_completeness: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

// ════════════════════════════════════════════════════════════════
// Payout Reconciliation Handlers
// ════════════════════════════════════════════════════════════════

/// POST /payouts  — initiate a payout (admin only)
pub async fn create_payout(
    pool: web::Data<PgPool>,
    body: web::Json<crate::payout_service::CreatePayoutRequest>,
    req: HttpRequest,
) -> impl Responder {
    let extensions = req.extensions();
    let claims = match extensions.get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().finish(),
    };
    drop(extensions);
    if claims.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required" }));
    }
    let svc = crate::payout_service::PayoutService::new(pool.get_ref().clone());
    match svc.create_payout_record(body.into_inner()).await {
        Ok(record) => HttpResponse::Created().json(record),
        Err(crate::payout_service::PayoutError::ProcessorDisabled) =>
            HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "Payment processor is not enabled. Configure via admin panel."
            })),
        Err(e) => { error!("create_payout: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /creators/me/payouts  — creator views their payout history
pub async fn get_my_payouts(
    pool: web::Data<PgPool>,
    query: web::Query<PaginationQuery>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let svc = crate::payout_service::PayoutService::new(pool.get_ref().clone());
    let limit = query.limit.unwrap_or(20);
    let offset = query.offset.unwrap_or(0);
    match svc.list_creator_payouts(user_id, limit, offset).await {
        Ok(payouts) => {
            let count = payouts.len();
            HttpResponse::Ok().json(serde_json::json!({ "payouts": payouts, "count": count }))
        },
        Err(e) => { error!("get_my_payouts: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /admin/payouts/reconciliation  — admin reconciliation summary
pub async fn admin_payout_reconciliation(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let extensions = req.extensions();
    let claims = match extensions.get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().finish(),
    };
    drop(extensions);
    if claims.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required" }));
    }
    let svc = crate::payout_service::PayoutService::new(pool.get_ref().clone());
    match svc.get_reconciliation_summary().await {
        Ok(summary) => HttpResponse::Ok().json(summary),
        Err(e) => { error!("admin_payout_reconciliation: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

// ══════════════════════════════════════════════════════════════
// Escrow Disputes — user-facing (create + list my disputes)
// ══════════════════════════════════════════════════════════════

/// POST /deal-rooms/{id}/disputes — raise a dispute on an escrow stage
pub async fn create_dispute(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::models::CreateDisputeRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let deal_room_id = path.into_inner();

    if body.reason.trim().is_empty() || body.reason.len() > 2000 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Reason must be 1-2000 characters"
        }));
    }

    // Verify user is participant and get the other party
    // deal_rooms stores creator_persona_id, resolve via personas table
    let participant: Option<(i64, i64)> = sqlx::query_as(
        "SELECT p.user_id, dr.brand_user_id
         FROM deal_rooms dr
         JOIN personas p ON p.id = dr.creator_persona_id
         WHERE dr.id = $1"
    )
    .bind(deal_room_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    let (creator_id, brand_id) = match participant {
        Some(p) => p,
        None => return HttpResponse::NotFound().json(serde_json::json!({ "error": "Deal room not found" })),
    };

    if user_id != creator_id && user_id != brand_id {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Not a participant" }));
    }

    let against_user_id = if user_id == creator_id { brand_id } else { creator_id };

    // Verify escrow stage belongs to this deal room
    let stage_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM escrow_stages WHERE id = $1 AND deal_room_id = $2)"
    )
    .bind(body.escrow_stage_id)
    .bind(deal_room_id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(false);

    if !stage_exists {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Escrow stage not found in this deal room"
        }));
    }

    match sqlx::query_scalar::<_, i64>(
        "INSERT INTO escrow_disputes (deal_room_id, escrow_stage_id, raised_by_user_id, against_user_id, reason, evidence_urls)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id"
    )
    .bind(deal_room_id)
    .bind(body.escrow_stage_id)
    .bind(user_id)
    .bind(against_user_id)
    .bind(body.reason.trim())
    .bind(&body.evidence_urls)
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(id) => {
            info!("Dispute {} created on deal_room {} by user {}", id, deal_room_id, user_id);
            HttpResponse::Created().json(serde_json::json!({
                "id": id, "deal_room_id": deal_room_id, "status": "open"
            }))
        }
        Err(e) => {
            if e.to_string().contains("unique") {
                return HttpResponse::Conflict().json(serde_json::json!({
                    "error": "A dispute already exists for this escrow stage"
                }));
            }
            error!("create_dispute: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /deal-rooms/{id}/disputes — list disputes for a deal room (participant only)
pub async fn list_deal_room_disputes(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let deal_room_id = path.into_inner();

    let is_participant: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM deal_rooms dr JOIN personas p ON p.id = dr.creator_persona_id WHERE dr.id = $1 AND (p.user_id = $2 OR dr.brand_user_id = $2))"
    )
    .bind(deal_room_id)
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(false);

    if !is_participant {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Not a participant" }));
    }

    let disputes: Vec<(i64, i64, i64, i64, String, String, Option<String>, chrono::DateTime<chrono::Utc>)> =
        match sqlx::query_as(
            "SELECT id, escrow_stage_id, raised_by_user_id, against_user_id, reason, status, resolution_notes, created_at
             FROM escrow_disputes
             WHERE deal_room_id = $1
             ORDER BY created_at DESC
             LIMIT 50"
        )
        .bind(deal_room_id)
        .fetch_all(pool.get_ref())
        .await {
            Ok(d) => d,
            Err(e) => { error!("list_deal_room_disputes: {:?}", e); return HttpResponse::InternalServerError().finish(); }
        };

    let entries: Vec<serde_json::Value> = disputes.iter().map(|d| {
        serde_json::json!({
            "id": d.0, "escrow_stage_id": d.1, "raised_by_user_id": d.2,
            "against_user_id": d.3, "reason": d.4, "status": d.5,
            "resolution_notes": d.6, "created_at": d.7.to_rfc3339(),
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({ "disputes": entries }))
}

// ══════════════════════════════════════════════════════════════
// Payment Preferences — advance % + performance clause
// ══════════════════════════════════════════════════════════════

/// POST /deal-rooms/{id}/payment-preferences — save payment terms (3-way split)
pub async fn save_payment_preferences(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::models::SavePaymentPreferencesRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let deal_room_id = path.into_inner();

    let advance_pct = body.advance_pct;
    let after_submission_pct = body.after_submission_pct.unwrap_or(0);
    let performance_pct = body.performance_pct.unwrap_or(100 - advance_pct - after_submission_pct);

    // Validate: each must be 0-100 and all three must sum to 100
    if advance_pct < 0 || advance_pct > 100
        || after_submission_pct < 0 || after_submission_pct > 100
        || performance_pct < 0 || performance_pct > 100
    {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Each payment percentage must be between 0 and 100"
        }));
    }
    if advance_pct + after_submission_pct + performance_pct != 100 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Payment split must sum to 100%, got {}%", advance_pct + after_submission_pct + performance_pct)
        }));
    }

    // Open transaction: participant check + upsert must be atomic.
    // Without a transaction, a concurrent request could remove the user from
    // the deal room between the SELECT and the INSERT/UPDATE (TOCTOU race).
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            error!("save_payment_preferences: failed to begin transaction: {:?}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    // Verify participant — lock the deal room row to prevent removal racing
    // with the upsert below.
    let is_participant: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
            SELECT 1 FROM deal_rooms dr
            JOIN personas p ON p.id = dr.creator_persona_id
            WHERE dr.id = $1
              AND (p.user_id = $2 OR dr.brand_user_id = $2)
            FOR UPDATE
        )"#
    )
    .bind(deal_room_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(false);

    if !is_participant {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Not a participant" }));
    }

    // Upsert 3-way split into deal_room_payment_preferences.
    //
    // `version` uses optimistic concurrency: each successful update increments
    // it. The client receives the new version and must supply it on the next
    // write if conflict detection is needed (future: add `expected_version`
    // parameter and reject if version != expected_version).
    //
    // ON CONFLICT targets the unique index on deal_room_id. Without the
    // version increment, concurrent writes silently overwrite each other with
    // no way to detect the conflict — a data-integrity hole in negotiation flows.
    let new_version: i32 = match sqlx::query_scalar(
        r#"INSERT INTO deal_room_payment_preferences
               (deal_room_id, advance_pct, after_submission_pct, performance_pct,
                performance_clause_enabled, updated_by_user_id, version)
           VALUES ($1, $2, $3, $4, $5, $6, 1)
           ON CONFLICT (deal_room_id) DO UPDATE SET
               advance_pct               = EXCLUDED.advance_pct,
               after_submission_pct      = EXCLUDED.after_submission_pct,
               performance_pct           = EXCLUDED.performance_pct,
               performance_clause_enabled= EXCLUDED.performance_clause_enabled,
               updated_by_user_id        = EXCLUDED.updated_by_user_id,
               updated_at                = NOW(),
               version                   = deal_room_payment_preferences.version + 1
           RETURNING version"#
    )
    .bind(deal_room_id)
    .bind(advance_pct)
    .bind(after_submission_pct)
    .bind(performance_pct)
    .bind(body.performance_clause_enabled)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            error!("save_payment_preferences: upsert failed: {:?}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    if let Err(e) = tx.commit().await {
        error!("save_payment_preferences: commit failed: {:?}", e);
        return HttpResponse::InternalServerError().finish();
    }

    HttpResponse::Ok().json(serde_json::json!({
        "deal_room_id": deal_room_id,
        "advance_pct": advance_pct,
        "after_submission_pct": after_submission_pct,
        "performance_pct": performance_pct,
        "performance_clause_enabled": body.performance_clause_enabled,
        "version": new_version,
    }))
}

/// GET /deal-rooms/{id}/payment-preferences — fetch payment terms
pub async fn get_payment_preferences(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let deal_room_id = path.into_inner();

    let is_participant: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM deal_rooms dr JOIN personas p ON p.id = dr.creator_persona_id WHERE dr.id = $1 AND (p.user_id = $2 OR dr.brand_user_id = $2))"
    )
    .bind(deal_room_id)
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(false);

    if !is_participant {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Not a participant" }));
    }

    // Include `version` so the client can use it for optimistic concurrency
    // on subsequent writes (compare against the version returned by save_payment_preferences).
    let prefs: Option<(i16, i16, i16, bool, i32)> = sqlx::query_as(
        "SELECT advance_pct, after_submission_pct, performance_pct, performance_clause_enabled, version
         FROM deal_room_payment_preferences
         WHERE deal_room_id = $1"
    )
    .bind(deal_room_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    match prefs {
        Some((advance_pct, after_submission_pct, performance_pct, perf_enabled, version)) => {
            HttpResponse::Ok().json(serde_json::json!({
                "deal_room_id": deal_room_id,
                "advance_pct": advance_pct,
                "after_submission_pct": after_submission_pct,
                "performance_pct": performance_pct,
                "performance_clause_enabled": perf_enabled,
                "version": version,
            }))
        }
        None => {
            // Default: 30% advance, 50% after submission, 20% performance.
            // version=0 signals "not yet saved" so clients know this is a default.
            HttpResponse::Ok().json(serde_json::json!({
                "deal_room_id": deal_room_id,
                "advance_pct": 30,
                "after_submission_pct": 50,
                "performance_pct": 20,
                "performance_clause_enabled": false,
                "version": 0,
            }))
        }
    }
}

// ══════════════════════════════════════════════════════════════
// Deal Finalization — Accept → auto-generate contract → update status
// ══════════════════════════════════════════════════════════════

/// POST /deal-rooms/{id}/finalize — mark deal as accepted, trigger contract generation
pub async fn finalize_deal(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<crate::models::FinalizeDealRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let deal_room_id = path.into_inner();

    // Verify participant — deal_rooms uses creator_persona_id, resolve to user_id via personas table
    let room: Option<(i64, i64, String)> = sqlx::query_as(
        "SELECT p.user_id, dr.brand_user_id, dr.status
         FROM deal_rooms dr
         JOIN personas p ON p.id = dr.creator_persona_id
         WHERE dr.id = $1"
    )
    .bind(deal_room_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    let (creator_id, brand_id, status) = match room {
        Some(r) => r,
        None => return HttpResponse::NotFound().json(serde_json::json!({ "error": "Deal room not found" })),
    };

    if user_id != creator_id && user_id != brand_id {
        return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Not a participant" }));
    }

    // Only finalize from active/negotiating status
    if status != "active" && status != "negotiating" && status != "offer_accepted" {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Cannot finalize deal in '{}' status", status)
        }));
    }

    // Start transaction: update status + insert system message
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => { error!("finalize_deal tx begin: {:?}", e); return HttpResponse::InternalServerError().finish(); }
    };

    // Update deal room status to 'finalized'
    if let Err(e) = sqlx::query(
        "UPDATE deal_rooms SET status = 'finalized', last_action_at = NOW() WHERE id = $1"
    )
    .bind(deal_room_id)
    .execute(&mut *tx)
    .await
    {
        error!("finalize_deal update: {:?}", e);
        return HttpResponse::InternalServerError().finish();
    }

    // Insert system message announcing finalization
    let finalize_msg = body.message.as_deref().unwrap_or("Deal finalized. Contract generation initiated.");
    if let Err(e) = sqlx::query(
        "INSERT INTO deal_room_messages (deal_room_id, sender_user_id, message_type, content)
         VALUES ($1, $2, 'deal_completed', $3)"
    )
    .bind(deal_room_id)
    .bind(user_id)
    .bind(finalize_msg)
    .execute(&mut *tx)
    .await
    {
        error!("finalize_deal message: {:?}", e);
        return HttpResponse::InternalServerError().finish();
    }

    // Insert event into outbox for contract generation
    if let Err(e) = sqlx::query(
        "INSERT INTO event_outbox (aggregate_type, aggregate_id, event_type, payload, created_at)
         VALUES ('deal_room', $1, 'deal_finalized', $2, NOW())"
    )
    .bind(deal_room_id)
    .bind(serde_json::json!({
        "deal_room_id": deal_room_id,
        "finalized_by": user_id,
        "creator_user_id": creator_id,
        "brand_user_id": brand_id,
    }))
    .execute(&mut *tx)
    .await
    {
        error!("finalize_deal outbox: {:?}", e);
        return HttpResponse::InternalServerError().finish();
    }

    match tx.commit().await {
        Ok(_) => {
            info!("Deal room {} finalized by user {}", deal_room_id, user_id);
            HttpResponse::Ok().json(serde_json::json!({
                "deal_room_id": deal_room_id,
                "status": "finalized",
                "message": "Deal finalized. Contract will be generated automatically.",
            }))
        }
        Err(e) => { error!("finalize_deal commit: {:?}", e); HttpResponse::InternalServerError().finish() }
    }
}

/// GET /deal-rooms/{id}/status — get deal room status
pub async fn get_deal_room_status(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };
    let deal_room_id = path.into_inner();

    let room: Option<(i64, i64, String, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        "SELECT p.user_id, dr.brand_user_id, dr.status, dr.created_at, COALESCE(dr.last_action_at, dr.created_at)
         FROM deal_rooms dr
         JOIN personas p ON p.id = dr.creator_persona_id
         WHERE dr.id = $1"
    )
    .bind(deal_room_id)
    .fetch_optional(pool.get_ref())
    .await
    .unwrap_or(None);

    match room {
        Some((creator_id, brand_id, status, created_at, last_action_at)) => {
            if user_id != creator_id && user_id != brand_id {
                return HttpResponse::Forbidden().json(serde_json::json!({ "error": "Not a participant" }));
            }
            HttpResponse::Ok().json(serde_json::json!({
                "deal_room_id": deal_room_id,
                "status": status,
                "creator_user_id": creator_id,
                "brand_user_id": brand_id,
                "created_at": created_at.to_rfc3339(),
                "updated_at": last_action_at.to_rfc3339(),
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({ "error": "Deal room not found" })),
    }
}

/// GET /marketplace/professions — List all professions with their ValueSkin images
/// Used by store page to dynamically display sticker images
pub async fn list_professions(
    pool: web::Data<PgPool>,
) -> impl Responder {
    match sqlx::query_as::<_, (i64, String, String, Option<String>)>(
        "SELECT id, name, category, image_uri FROM professions WHERE is_active = TRUE ORDER BY name"
    )
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => {
            let professions: Vec<serde_json::Value> = rows.iter().map(|(id, name, category, image_uri)| {
                serde_json::json!({
                    "id": id,
                    "name": name,
                    "category": category,
                    "image_uri": image_uri,
                })
            }).collect();

            HttpResponse::Ok().json(serde_json::json!({
                "professions": professions,
                "count": professions.len()
            }))
        }
        Err(e) => {
            error!("Failed to list professions: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch professions"
            }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_idempotency_key, IdempotencyKeyError};
    use actix_web::test::TestRequest;

    #[test]
    fn parses_valid_idempotency_key() {
        let req = TestRequest::default()
            .insert_header(("Idempotency-Key", "order_123-abc.DEF"))
            .to_http_request();
        assert_eq!(parse_idempotency_key(&req).unwrap(), "order_123-abc.DEF");
    }

    #[test]
    fn rejects_missing_or_invalid_idempotency_key() {
        let missing = TestRequest::default().to_http_request();
        assert!(matches!(parse_idempotency_key(&missing), Err(IdempotencyKeyError::Missing)));

        let invalid = TestRequest::default()
            .insert_header(("Idempotency-Key", "bad key with spaces"))
            .to_http_request();
        assert!(matches!(parse_idempotency_key(&invalid), Err(IdempotencyKeyError::Invalid)));
    }
}
