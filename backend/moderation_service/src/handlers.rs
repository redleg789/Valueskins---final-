use crate::models::*;
use crate::service::ModerationService;
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

fn require_moderator(req: &HttpRequest) -> Result<i64, HttpResponse> {
    let user_id = get_user_id(req)?;
    let claims = req.extensions()
        .get::<auth_service::token::Claims>()
        .cloned()
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})))?;

    if claims.role != "moderator" && claims.role != "admin" {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Moderator access required"
        })));
    }
    Ok(user_id)
}

fn get_client_ip(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| req.peer_addr().map(|a| a.ip().to_string()))
}

fn internal_error(msg: &str) -> HttpResponse {
    HttpResponse::InternalServerError().json(serde_json::json!({"error": msg}))
}

// ============================================================
// Public (any authenticated user)
// ============================================================

/// Submit a report against another user.
pub async fn create_report(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<CreateReportRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = ModerationService::new((**pool).clone());
    match service.create_report(user_id, &body).await {
        Ok(item) => HttpResponse::Ok().json(item),
        Err(e) => {
            match e {
                ModerationError::CannotReportSelf => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Cannot report yourself"}))
                }
                ModerationError::UserNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Target user not found"}))
                }
                ModerationError::TargetIsModerator => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Cannot report moderators through this channel"}))
                }
                ModerationError::DuplicateReport => {
                    HttpResponse::Conflict().json(serde_json::json!({"error": "An open report already exists for this user"}))
                }
                _ => internal_error("Failed to submit report"),
            }
        }
    }
}

/// Get your own reports (submitted by you).
pub async fn get_own_reports(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let items: Vec<ModerationQueueItem> = match sqlx::query_as(
        "SELECT mq.id, mq.target_user_id, mq.target_company_id, mq.target_contract_id,
                mq.source, mq.priority, mq.category, mq.description,
                mq.assigned_moderator_user_id, mq.moderator_action, mq.moderator_notes,
                mq.action_taken_at, mq.requires_escalation, mq.escalated_to_user_id,
                mq.escalated_at, mq.escalation_reason, mq.is_appealable, mq.appeal_deadline,
                mq.status, mq.created_at, mq.updated_at
         FROM moderation_queue mq
         JOIN report_creators rc ON rc.queue_item_id = mq.id
         WHERE rc.reporter_user_id = $1
         ORDER BY mq.created_at DESC
         LIMIT 50"
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(r) => r,
        Err(_) => return internal_error("Failed to fetch reports"),
    };

    HttpResponse::Ok().json(items)
}

/// File an appeal against a moderation action on your account.
pub async fn file_appeal(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<FileAppealRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let queue_item_id = path.into_inner();
    let service = ModerationService::new((**pool).clone());
    match service.file_appeal(queue_item_id, user_id, &body).await {
        Ok(appeal) => HttpResponse::Ok().json(appeal),
        Err(e) => {
            match e {
                ModerationError::QueueItemNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Report not found"}))
                }
                ModerationError::InvalidStateTransition(msg) => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
                }
                _ => internal_error("Failed to file appeal"),
            }
        }
    }
}

// ============================================================
// Moderator-only
// ============================================================

/// Get the moderation queue with filters.
pub async fn get_queue(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<QueueQueryParams>,
) -> HttpResponse {
    if let Err(resp) = require_moderator(&req) { return resp; }

    let service = ModerationService::new((**pool).clone());
    match service.get_queue(&params).await {
        Ok(items) => HttpResponse::Ok().json(items),
        Err(_) => internal_error("Failed to fetch queue"),
    }
}

/// Get a single queue item with full details.
pub async fn get_queue_item(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    if let Err(resp) = require_moderator(&req) { return resp; }

    let item_id = path.into_inner();
    let service = ModerationService::new((**pool).clone());
    match service.get_queue_item(item_id).await {
        Ok(item) => HttpResponse::Ok().json(item),
        Err(ModerationError::QueueItemNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Queue item not found"}))
        }
        Err(_) => internal_error("Failed to fetch queue item"),
    }
}

/// Get queue statistics.
pub async fn get_queue_stats(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    if let Err(resp) = require_moderator(&req) { return resp; }

    let service = ModerationService::new((**pool).clone());
    match service.get_queue_stats().await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(_) => internal_error("Failed to fetch stats"),
    }
}

/// Assign a moderator to a queue item.
pub async fn assign_moderator(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<AssignModeratorRequest>,
) -> HttpResponse {
    let moderator_id = match require_moderator(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let item_id = path.into_inner();
    let ip = get_client_ip(&req);
    let service = ModerationService::new((**pool).clone());

    match service.assign_moderator(item_id, body.moderator_user_id, moderator_id, ip).await {
        Ok(item) => HttpResponse::Ok().json(item),
        Err(e) => {
            match e {
                ModerationError::QueueItemNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Queue item not found"}))
                }
                ModerationError::AlreadyResolved => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Item already resolved"}))
                }
                _ => internal_error("Failed to assign moderator"),
            }
        }
    }
}

/// Take moderation action (warning, suspend, ban, etc.).
pub async fn take_action(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<TakeActionRequest>,
) -> HttpResponse {
    let moderator_id = match require_moderator(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let item_id = path.into_inner();
    let ip = get_client_ip(&req);
    let service = ModerationService::new((**pool).clone());

    match service.take_action(item_id, moderator_id, &body, ip).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => {
            match e {
                ModerationError::QueueItemNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Queue item not found"}))
                }
                ModerationError::AlreadyResolved => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Item already resolved"}))
                }
                ModerationError::InvalidAction(msg) => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
                }
                _ => internal_error("Failed to take action"),
            }
        }
    }
}

/// Add investigation notes to a queue item.
pub async fn add_notes(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<AddNoteRequest>,
) -> HttpResponse {
    let moderator_id = match require_moderator(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let item_id = path.into_inner();
    let ip = get_client_ip(&req);
    let service = ModerationService::new((**pool).clone());

    match service.add_notes(item_id, moderator_id, &body.notes, ip).await {
        Ok(item) => HttpResponse::Ok().json(item),
        Err(e) => {
            match e {
                ModerationError::QueueItemNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Queue item not found"}))
                }
                _ => internal_error("Failed to add notes"),
            }
        }
    }
}

/// Escalate a queue item to senior moderation or legal.
pub async fn escalate(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<EscalateRequest>,
) -> HttpResponse {
    let moderator_id = match require_moderator(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let item_id = path.into_inner();
    let ip = get_client_ip(&req);
    let service = ModerationService::new((**pool).clone());

    match service.escalate(item_id, moderator_id, &body, ip).await {
        Ok(item) => HttpResponse::Ok().json(item),
        Err(e) => {
            match e {
                ModerationError::QueueItemNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Queue item not found"}))
                }
                ModerationError::AlreadyAtHighestLevel => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Already escalated to highest level"}))
                }
                _ => internal_error("Failed to escalate"),
            }
        }
    }
}

/// Review an appeal (moderator).
pub async fn review_appeal(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<ReviewAppealRequest>,
) -> HttpResponse {
    let moderator_id = match require_moderator(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let appeal_id = path.into_inner();
    let ip = get_client_ip(&req);
    let service = ModerationService::new((**pool).clone());

    match service.review_appeal(appeal_id, moderator_id, &body, ip).await {
        Ok(appeal) => HttpResponse::Ok().json(appeal),
        Err(e) => {
            match e {
                ModerationError::AppealNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Appeal not found"}))
                }
                ModerationError::AppealAlreadyResolved => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Appeal already resolved"}))
                }
                ModerationError::InvalidAction(msg) => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
                }
                _ => internal_error("Failed to review appeal"),
            }
        }
    }
}

/// Get the moderator audit log.
pub async fn get_audit_log(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<AuditQueryParams>,
) -> HttpResponse {
    if let Err(resp) = require_moderator(&req) { return resp; }

    let service = ModerationService::new((**pool).clone());
    match service.get_audit_log(&params).await {
        Ok(entries) => HttpResponse::Ok().json(entries),
        Err(_) => internal_error("Failed to fetch audit log"),
    }
}

/// Get active restrictions for a user.
pub async fn get_user_restrictions(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    if let Err(resp) = require_moderator(&req) { return resp; }

    let user_id = path.into_inner();
    let service = ModerationService::new((**pool).clone());
    match service.get_user_restrictions(user_id).await {
        Ok(restrictions) => HttpResponse::Ok().json(restrictions),
        Err(_) => internal_error("Failed to get restrictions"),
    }
}

/// Get moderation history for a user.
pub async fn get_user_moderation_history(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    if let Err(resp) = require_moderator(&req) { return resp; }

    let user_id = path.into_inner();
    let service = ModerationService::new((**pool).clone());
    match service.get_user_moderation_history(user_id).await {
        Ok(items) => HttpResponse::Ok().json(items),
        Err(_) => internal_error("Failed to get moderation history"),
    }
}

// ============================================================
// Route Configuration
// ============================================================

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        // Public: report + appeal
        web::scope("/api/v1/moderation")
            .route("/reports", web::post().to(create_report))
            .route("/reports/mine", web::get().to(get_own_reports))
            .route("/reports/{id}/appeal", web::post().to(file_appeal))
    )
    .service(
        // Moderator-only
        web::scope("/api/v1/admin/moderation")
            .route("/queue", web::get().to(get_queue))
            .route("/queue/stats", web::get().to(get_queue_stats))
            .route("/queue/{id}", web::get().to(get_queue_item))
            .route("/queue/{id}/assign", web::post().to(assign_moderator))
            .route("/queue/{id}/action", web::post().to(take_action))
            .route("/queue/{id}/notes", web::post().to(add_notes))
            .route("/queue/{id}/escalate", web::post().to(escalate))
            .route("/appeals/{id}/review", web::post().to(review_appeal))
            .route("/audit-log", web::get().to(get_audit_log))
            .route("/users/{id}/restrictions", web::get().to(get_user_restrictions))
            .route("/users/{id}/history", web::get().to(get_user_moderation_history))
    );
}
