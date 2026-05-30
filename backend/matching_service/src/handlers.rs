use actix_web::{web, HttpRequest, HttpResponse, Responder, HttpMessage};
use shared::read_replica::ReplicaRouter;
use tracing::error;
use chrono::Utc;

use crate::models::*;
use crate::service::{MatchingService, MatchingError};

fn error_response(err: MatchingError) -> HttpResponse {
    match err {
        MatchingError::NoProfessionSpecified => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "At least one profession (ValuSkin field) must be specified"
            }))
        }
        MatchingError::InvalidLevel => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Level must be between 1 and 5"
            }))
        }
        MatchingError::RateLimited { limit, window } => {
            HttpResponse::TooManyRequests().json(serde_json::json!({
                "error": format!("Rate limited: max {} scans per {}", limit, window)
            }))
        }
        MatchingError::NotFound => {
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Resource not found"
            }))
        }
        MatchingError::Database(sqlx::Error::RowNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Resource not found or access denied"
            }))
        }
        MatchingError::Database(e) => {
            error!(error = %e, "Matching service database error");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            }))
        }
    }
}

/// GET /matching/creators?profession=Software+Engineer&min_level=2&barter_only=true
///
/// Brand discovers creators filtered by ValuSkin match.
/// Only returns creators who hold the specified profession as a ValuSkin.
pub async fn discover_creators(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    query: web::Query<DiscoverCreatorsQuery>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.discover_creators(user_id, &query).await {
        Ok((creators, total_count)) => HttpResponse::Ok().json(serde_json::json!({
            "creators": creators,
            "matching_rule": "ValuSkin-based: only creators with matching profession are shown",
            "total": total_count,
        })),
        Err(e) => error_response(e),
    }
}

/// GET /matching/opportunities?valueskin=Software+Engineer
///
/// Creator discovers opportunities matched to their ValuSkin.
/// Only returns opportunities from brands targeting the creator's profession.
pub async fn discover_opportunities(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    query: web::Query<DiscoverOpportunitiesQuery>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.discover_opportunities(user_id, &query).await {
        Ok((opps, total_count)) => HttpResponse::Ok().json(serde_json::json!({
            "opportunities": opps,
            "matching_rule": "Only opportunities requiring your ValuSkin profession are shown",
            "valueskin": &query.valueskin,
            "total": total_count,
        })),
        Err(e) => error_response(e),
    }
}

/// POST /matching/opportunities/{id}/requirements
///
/// Brand sets which ValuSkin field(s) an opportunity targets.
/// At least one profession must be specified.
pub async fn set_requirements(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    path: web::Path<i64>,
    body: web::Json<SetMatchingRequirementsRequest>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let opportunity_id = path.into_inner();
    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.set_requirements(opportunity_id, user_id, &body).await {
        Ok(reqs) => HttpResponse::Ok().json(serde_json::json!({
            "requirements": reqs,
            "message": "Matching requirements updated — only creators with these ValuSkins will see this opportunity",
        })),
        Err(e) => error_response(e),
    }
}

/// GET /matching/opportunities/{id}/requirements
///
/// Get the matching requirements for an opportunity.
pub async fn get_requirements(
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    path: web::Path<i64>,
) -> impl Responder {
    let opportunity_id = path.into_inner();
    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.get_requirements(opportunity_id).await {
        Ok(reqs) => HttpResponse::Ok().json(reqs),
        Err(e) => error_response(e),
    }
}

/// GET /matching/audit?limit=50
///
/// Get match audit log for the authenticated user (brand or creator).
#[derive(serde::Deserialize)]
pub struct AuditLogQuery {
    pub limit: Option<i64>,
}

pub async fn get_audit_log(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    query: web::Query<AuditLogQuery>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let limit = query.limit.unwrap_or(50).min(100);
    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.get_audit_log(user_id, limit).await {
        Ok(log) => HttpResponse::Ok().json(log),
        Err(e) => error_response(e),
    }
}

// === DEAL SUGGESTION HANDLERS ===

/// GET /matching/suggestions?persona_id=123&min_score=50&advance_only=true
pub async fn get_suggestions(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    query: web::Query<SuggestionQuery>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let _user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.get_suggestions(&query).await {
        Ok((suggestions, total_count)) => HttpResponse::Ok().json(serde_json::json!({
            "suggestions": suggestions,
            "total": total_count,
            "note": "Ranked by match score. advance_compatible=true means brand offers advances."
        })),
        Err(e) => error_response(e),
    }
}

/// POST /matching/suggestions/{id}/action
pub async fn act_on_suggestion(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    path: web::Path<i64>,
    body: web::Json<SuggestionAction>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let suggestion_id = path.into_inner();
    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.act_on_suggestion(user_id, suggestion_id, &body.action).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "message": format!("Suggestion {}", body.action)
        })),
        Err(e) => error_response(e),
    }
}

/// POST /matching/opportunities/{id}/generate-suggestions
pub async fn generate_suggestions(
    req: HttpRequest,
    router: web::Data<ReplicaRouter>,
    cache: web::Data<shared::cache::RedisCache>,
    path: web::Path<i64>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let opportunity_id = path.into_inner();
    let service = MatchingService::new_with_read_pool(router.write_pool().clone(), router.read_pool().clone(), cache.get_ref().clone());
    match service.generate_suggestions_for_opportunity(user_id, opportunity_id).await {
        Ok(count) => HttpResponse::Ok().json(serde_json::json!({
            "suggestions_generated": count,
            "message": "Deal suggestions generated based on ValuSkin match + advance compatibility"
        })),
        Err(e) => error_response(e),
    }
}

// === MARKETPLACE PERSONA MATCHING ===

/// GET /matching/persona/{persona_id}/opportunities?limit=20&offset=0
///
/// Get opportunities matched to a creator's ValuSkins (professions).
/// Used by marketplace page to filter opportunities by persona match.
/// No authentication required for public creator profile viewing,
/// but persona must exist and not be deleted.
#[derive(serde::Deserialize)]
pub struct PersonaOpportunitiesQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub compensation_filter: Option<String>,
}

pub async fn get_persona_matched_opportunities(
    router: web::Data<ReplicaRouter>,
    path: web::Path<i64>,
    query: web::Query<PersonaOpportunitiesQuery>,
) -> impl Responder {
    let persona_id = path.into_inner();

    // Validate persona exists and is not deleted
    let persona_valid: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM personas WHERE id = $1 AND exists = TRUE)"
    )
    .bind(persona_id)
    .fetch_one(&*router.read_pool())
    .await
    .unwrap_or(false);

    if !persona_valid {
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Persona not found or has been deleted"
        }));
    }

    let limit = query.limit.unwrap_or(20).max(1).min(100) as i64;
    let offset = query.offset.unwrap_or(0).max(0) as i64;

    // Fetch all professions (ValuSkins) this persona holds
    #[derive(sqlx::FromRow)]
    struct PersonaProfession {
        profession_id: i64,
        profession_name: String,
    }

    let professions = match sqlx::query_as::<_, PersonaProfession>(
        r#"
        SELECT pp.profession_id, pr.name AS profession_name
        FROM persona_professions pp
        JOIN professions pr ON pp.profession_id = pr.id
        WHERE pp.persona_id = $1
        ORDER BY pp.level DESC
        "#
    )
    .bind(persona_id)
    .fetch_all(&*router.read_pool())
    .await
    {
        Ok(profs) => profs,
        Err(e) => {
            error!(error = %e, "Failed to fetch persona professions");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            }));
        }
    };

    if professions.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "opportunities": [],
            "total": 0,
            "message": "Creator has not set up any ValuSkins yet",
            "persona_id": persona_id,
        }));
    }

    // Get profession names for WHERE clause
    let profession_names: Vec<String> = professions.iter().map(|p| p.profession_name.clone()).collect();

    // Fetch opportunities that match ANY of the creator's professions
    #[derive(sqlx::FromRow)]
    struct OpportunityRow {
        opportunity_id: i64,
        brand_name: String,
        title: String,
        description: Option<String>,
        campaign_type: String,
        required_profession: String,
        min_level: i32,
        compensation_type: String,
        reward_amount: Option<i64>,
        reward_currency: String,
        match_score: f64,
        total_count: i64,
    }

    let rows = match sqlx::query_as::<_, OpportunityRow>(
        r#"
        SELECT
            o.id AS opportunity_id,
            u.display_name AS brand_name,
            o.title,
            o.description,
            COALESCE(o.compensation_type, 'paid') AS campaign_type,
            mr.required_profession,
            COALESCE(mr.min_level, 1) AS min_level,
            COALESCE(o.compensation_type, 'paid') AS compensation_type,
            o.reward_amount,
            COALESCE(o.reward_currency, 'USD') AS reward_currency,
            50.0 AS match_score,
            COUNT(*) OVER()::int8 AS total_count
        FROM matching_requirements mr
        JOIN opportunities o ON mr.opportunity_id = o.id AND o.status = 'active'
        JOIN users u ON o.brand_user_id = u.id
        WHERE mr.required_profession = ANY($1)
          AND ($2::TEXT IS NULL OR o.compensation_type = $2)
        ORDER BY mr.priority ASC, o.created_at DESC
        LIMIT $3 OFFSET $4
        "#
    )
    .bind(&profession_names)
    .bind(query.compensation_filter.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(&*router.read_pool())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            error!(error = %e, "Failed to fetch matched opportunities");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            }));
        }
    };

    let total_count = rows.first().map(|r| r.total_count).unwrap_or(0);

    let opportunities: Vec<serde_json::Value> = rows.into_iter().map(|r| {
        serde_json::json!({
            "opportunity_id": r.opportunity_id,
            "brand_name": r.brand_name,
            "title": r.title,
            "description": r.description,
            "campaign_type": r.campaign_type,
            "required_profession": r.required_profession,
            "min_level": r.min_level,
            "compensation_type": r.compensation_type,
            "reward_amount": r.reward_amount,
            "reward_currency": r.reward_currency,
            "match_score": r.match_score,
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "opportunities": opportunities,
        "total": total_count,
        "persona_id": persona_id,
        "professions_matched": profession_names,
        "matching_rule": "Only opportunities requiring your ValuSkin professions are shown"
    }))
}

// === DEAL ROOM CHAT HANDLERS ===

#[derive(serde::Deserialize)]
pub struct SendMessageRequest {
    pub message: String,
}

#[derive(serde::Serialize)]
pub struct ChatMessage {
    pub id: i64,
    pub deal_room_id: i64,
    pub sender_user_id: i64,
    pub sender_name: String,
    pub content: String,
    pub message_type: String,
    pub server_timestamp: String,
}

#[derive(serde::Deserialize)]
pub struct ChatHistoryQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

/// GET /deal-rooms/{deal_room_id}/chat?limit=50&offset=0
///
/// Fetch chat history for a deal room.
/// User must be either the brand or creator of the deal room.
/// Returns messages in chronological order (oldest first).
pub async fn get_chat_history(
    req: HttpRequest,
    pool: web::Data<sqlx::PgPool>,
    path: web::Path<i64>,
    query: web::Query<ChatHistoryQuery>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let deal_room_id = path.into_inner();
    let limit = query.limit.unwrap_or(50).max(1).min(200) as i64;
    let offset = query.offset.unwrap_or(0).max(0) as i64;

    // Verify user is participant in this deal room
    let is_participant: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM deal_rooms
            WHERE id = $1 AND (brand_user_id = $2 OR creator_persona_id IN (
                SELECT id FROM personas WHERE owner_user_id = $2
            ))
        )
        "#
    )
    .bind(deal_room_id)
    .bind(user_id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap_or(false);

    if !is_participant {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied: you are not a participant in this deal room"
        }));
    }

    // Fetch chat messages
    #[derive(sqlx::FromRow)]
    struct MessageRow {
        id: i64,
        deal_room_id: i64,
        sender_user_id: i64,
        sender_name: String,
        content: String,
        message_type: String,
        server_timestamp: chrono::DateTime<Utc>,
    }

    let messages = match sqlx::query_as::<_, MessageRow>(
        r#"
        SELECT
            dm.id,
            dm.deal_room_id,
            dm.sender_user_id,
            u.display_name AS sender_name,
            dm.content,
            dm.message_type,
            dm.server_timestamp
        FROM deal_room_messages dm
        JOIN users u ON dm.sender_user_id = u.id
        WHERE dm.deal_room_id = $1
        ORDER BY dm.server_timestamp ASC
        LIMIT $2 OFFSET $3
        "#
    )
    .bind(deal_room_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool.as_ref())
    .await
    {
        Ok(msgs) => msgs,
        Err(e) => {
            error!(error = %e, deal_room_id = %deal_room_id, "Failed to fetch chat messages");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch messages"
            }));
        }
    };

    let chat_messages: Vec<ChatMessage> = messages.into_iter().map(|m| ChatMessage {
        id: m.id,
        deal_room_id: m.deal_room_id,
        sender_user_id: m.sender_user_id,
        sender_name: m.sender_name,
        content: m.content,
        message_type: m.message_type,
        server_timestamp: m.server_timestamp.to_rfc3339(),
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "messages": chat_messages,
        "deal_room_id": deal_room_id,
        "count": chat_messages.len(),
    }))
}

/// POST /deal-rooms/{deal_room_id}/chat
///
/// Send a message in a deal room.
/// User must be either the brand or creator of the deal room.
/// Validates message length and updates deal room activity timestamp.
pub async fn send_message(
    req: HttpRequest,
    pool: web::Data<sqlx::PgPool>,
    path: web::Path<i64>,
    body: web::Json<SendMessageRequest>,
) -> impl Responder {
    let claims = match req.extensions().get::<auth_service::token::Claims>() {
        Some(c) => c.clone(),
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let user_id: i64 = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid user ID"})),
    };

    let deal_room_id = path.into_inner();

    // Validate message
    let message = body.message.trim();
    if message.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message cannot be empty"
        }));
    }
    if message.len() > 5000 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message exceeds maximum length of 5000 characters"
        }));
    }

    // Verify user is participant in this deal room
    let is_participant: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM deal_rooms
            WHERE id = $1 AND (brand_user_id = $2 OR creator_persona_id IN (
                SELECT id FROM personas WHERE owner_user_id = $2
            ))
        )
        "#
    )
    .bind(deal_room_id)
    .bind(user_id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap_or(false);

    if !is_participant {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied: you are not a participant in this deal room"
        }));
    }

    // Insert message and update deal room activity
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            error!(error = %e, "Failed to begin transaction");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            }));
        }
    };

    // Insert message (content + message_type match the original migration schema;
    // server_timestamp defaults to NOW() via column default)
    let message_result = sqlx::query(
        r#"
        INSERT INTO deal_room_messages (deal_room_id, sender_user_id, content, message_type)
        VALUES ($1, $2, $3, 'text')
        RETURNING id, server_timestamp
        "#
    )
    .bind(deal_room_id)
    .bind(user_id)
    .bind(message)
    .fetch_one(&mut *tx)
    .await;

    let (message_id, sent_at) = match message_result {
        Ok(row) => {
            use sqlx::Row;
            let id: i64 = row.get("id");
            let ts: chrono::DateTime<Utc> = row.get("server_timestamp");
            (id, ts)
        }
        Err(e) => {
            error!(error = %e, deal_room_id = %deal_room_id, "Failed to insert message");
            let _ = tx.rollback().await;
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to send message"
            }));
        }
    };

    // Update deal room's last_action_at and expires_at (extend window by 48 hours)
    let update_result = sqlx::query(
        r#"
        UPDATE deal_rooms
        SET last_action_at = NOW(),
            expires_at = NOW() + INTERVAL '48 hours'
        WHERE id = $1 AND status = 'active'
        "#
    )
    .bind(deal_room_id)
    .execute(&mut *tx)
    .await;

    if update_result.is_err() {
        let _ = tx.rollback().await;
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to update deal room"
        }));
    }

    if let Err(e) = tx.commit().await {
        error!(error = %e, "Failed to commit transaction");
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Internal server error"
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "message_id": message_id,
        "deal_room_id": deal_room_id,
        "sent_at": sent_at.to_rfc3339(),
    }))
}
