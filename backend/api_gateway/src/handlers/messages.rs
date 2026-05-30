//! Deal room messages — POST/GET handlers for `/deal-rooms/{id}/messages`.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use sqlx::PgPool;
use serde::Deserialize;

/// Extract the authenticated user's ID from JWT claims injected by middleware.
///
/// Returns an explicit 401 with a structured error body on any failure:
/// - Missing claims (unauthenticated request that bypassed middleware)
/// - Malformed `sub` field that cannot be parsed as i64 (corrupted/tampered token)
///
/// Using `.unwrap_or(0)` was silently treating malformed JWTs as user_id=0,
/// which could match rows where user_id IS NULL or 0 — a security hole.
fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    let extensions = req.extensions();
    let claims = extensions
        .get::<auth_service::token::Claims>()
        .ok_or_else(|| {
            tracing::warn!("Authentication required: no JWT claims found in request extensions");
            HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Authentication required"
            }))
        })?;

    claims.sub.parse::<i64>().map_err(|e| {
        // This should never happen in normal operation — it means the JWT was
        // issued with a non-numeric sub or has been tampered with. Log it.
        tracing::error!(
            sub = %claims.sub,
            error = %e,
            "Malformed JWT: sub field is not a valid i64 user ID"
        );
        HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid authentication token"
        }))
    })
}

/// Validate message content for disallowed bytes.
///
/// Rejects:
/// - Null bytes (\x00): database corruption vector, breaks C-string APIs
/// - ASCII control characters below 0x20 except \t (0x09), \n (0x0A), \r (0x0D)
///   These have no legitimate use in chat messages and are used in injection attacks.
fn validate_content(content: &str) -> bool {
    content.bytes().all(|b| match b {
        0x00 => false,                                    // null byte — always reject
        0x01..=0x08 => false,                             // SOH..BS control chars
        0x09 => true,                                     // horizontal tab — allow
        0x0A => true,                                     // newline — allow
        0x0B..=0x0C => false,                             // VT, FF control chars
        0x0D => true,                                     // carriage return — allow
        0x0E..=0x1F => false,                             // SO..US control chars
        _ => true,                                        // printable + extended UTF-8
    })
}

/// Allowed message types that a user can send directly.
/// System-generated types (offer_accepted, contract_signed, etc.) are NOT allowed here
/// to prevent spoofing — those are only created server-side.
const ALLOWED_USER_MESSAGE_TYPES: &[&str] = &["text", "offer_made", "counter_offer"];

/// Per-user rate limit: max messages per 1-minute sliding window.
const RATE_LIMIT_MESSAGES_PER_MINUTE: i64 = 30;

#[derive(Deserialize)]
pub struct SendMessageBody {
    pub content: String,
    pub message_type: Option<String>,
}

#[derive(Deserialize)]
pub struct MessageQuery {
    pub limit: Option<i64>,
    /// Cursor: return messages with id > after_id (ascending order).
    /// Renamed from `before_id` to reflect correct forward-pagination semantics.
    pub after_id: Option<i64>,
}

/// POST /deal-rooms/{id}/messages
pub async fn post_message(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<SendMessageBody>,
) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };
    let deal_room_id = path.into_inner();
    let content = body.content.trim();

    // Length check first (cheap, no DB)
    if content.is_empty() || content.len() > 5000 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message must be 1-5000 characters"
        }));
    }

    // Content safety: reject null bytes and disallowed control characters.
    // This prevents database corruption, injection attacks, and protocol smuggling.
    if !validate_content(content) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message contains disallowed characters (null bytes or control characters)"
        }));
    }

    // Validate message_type — only allow user-sendable types, never system-generated ones
    let msg_type_str = body.message_type.as_deref().unwrap_or("text");
    if !ALLOWED_USER_MESSAGE_TYPES.contains(&msg_type_str) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Invalid message_type '{}'. Allowed: {:?}", msg_type_str, ALLOWED_USER_MESSAGE_TYPES)
        }));
    }

    // Open a transaction so that the participant check + rate limit check +
    // message insert are atomic. Without a transaction these three steps are a
    // TOCTOU race: another process could remove the user from the deal room, or
    // a flood of concurrent requests could bypass the rate limit, between the
    // SELECT and the INSERT.
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!(error = %e, "Failed to begin transaction for post_message");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to process request"
            }));
        }
    };

    // Verify user is participant — lock the deal room row to prevent concurrent
    // removal racing with this insert (TOCTOU fix).
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
        // Rollback is implicit when tx is dropped
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You are not a participant in this deal room"
        }));
    }

    // Per-user rate limit: count messages sent in the last 1 minute.
    // This runs inside the transaction so concurrent requests cannot both pass
    // the check and insert beyond the limit simultaneously.
    let recent_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM deal_room_messages
           WHERE sender_user_id = $1
             AND server_timestamp > NOW() - INTERVAL '1 minute'"#
    )
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    if recent_count >= RATE_LIMIT_MESSAGES_PER_MINUTE {
        tracing::warn!(
            user_id = user_id,
            recent_count = recent_count,
            "Rate limit exceeded for post_message"
        );
        return HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Rate limit exceeded: max 30 messages per minute",
            "retry_after_seconds": 60,
        }));
    }

    // Insert the message within the same transaction.
    match sqlx::query_as::<_, (i64, String, i64, String, chrono::DateTime<chrono::Utc>)>(
        r#"INSERT INTO deal_room_messages (deal_room_id, sender_user_id, message_type, content)
           VALUES ($1, $2, $3, $4)
           RETURNING id, content, sender_user_id, message_type, server_timestamp"#
    )
    .bind(deal_room_id)
    .bind(user_id)
    .bind(msg_type_str)
    .bind(content)
    .fetch_one(&mut *tx)
    .await
    {
        Ok((id, msg_content, sender, msg_type, ts)) => {
            if let Err(e) = tx.commit().await {
                tracing::error!(error = %e, "Failed to commit post_message transaction");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to send message"
                }));
            }
            HttpResponse::Created().json(serde_json::json!({
                "id": id,
                "deal_room_id": deal_room_id,
                "sender_user_id": sender,
                "message_type": msg_type,
                "content": msg_content,
                "server_timestamp": ts,
            }))
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to send message");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to send message"}))
        }
    }
}

/// GET /deal-rooms/{id}/messages
///
/// Cursor-based pagination using `after_id` (exclusive lower bound).
/// Returns messages with `id > after_id ORDER BY id ASC` so the client
/// always advances forward. This is stable and consistent because `id` is
/// a monotonic sequence, unlike `server_timestamp` which can have clock skew
/// collisions and does not guarantee uniqueness.
pub async fn get_messages(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    query: web::Query<MessageQuery>,
) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };
    let deal_room_id = path.into_inner();
    let limit = query.limit.unwrap_or(100).min(200).max(1);

    // Verify user is participant (read-only, no lock needed here)
    let is_participant: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM deal_rooms dr JOIN personas p ON p.id = dr.creator_persona_id WHERE dr.id = $1 AND (p.user_id = $2 OR dr.brand_user_id = $2))"
    )
    .bind(deal_room_id)
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(false);

    if !is_participant {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You are not a participant in this deal room"
        }));
    }

    // Cursor pagination: `id > $2 ORDER BY id ASC`
    //
    // The old query used `id < $2 ORDER BY server_timestamp ASC` which was
    // broken in two ways:
    //   1. `id < $2` returns *older* messages (going backwards) while
    //      `ORDER BY server_timestamp ASC` sorts oldest-first — making paging
    //      return decreasing windows of older history on each page.
    //   2. Ordering by `server_timestamp` is not stable when two messages land
    //      in the same millisecond (concurrent inserts), so the cursor position
    //      can drift between pages.
    //
    // The fix: `id > $2 ORDER BY id ASC` — forward-only, stable, index-backed.
    // Pass `after_id = NULL` (omit parameter) to get the first page.
    let messages: Vec<(i64, i64, String, String, chrono::DateTime<chrono::Utc>)> = match sqlx::query_as(
        r#"SELECT id, sender_user_id, message_type, content, server_timestamp
           FROM deal_room_messages
           WHERE deal_room_id = $1
             AND ($2::int8 IS NULL OR id > $2)
           ORDER BY id ASC
           LIMIT $3"#
    )
    .bind(deal_room_id)
    .bind(query.after_id)
    .bind(limit)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch messages");
            return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to fetch messages"}));
        }
    };

    let msgs: Vec<serde_json::Value> = messages.iter().map(|(id, sender, msg_type, content, ts)| {
        serde_json::json!({
            "id": id,
            "deal_room_id": deal_room_id,
            "sender_user_id": sender,
            "message_type": msg_type,
            "content": content,
            "server_timestamp": ts,
        })
    }).collect();

    // Surface the next cursor so the client knows where to resume.
    let next_cursor = messages.last().map(|(id, ..)| *id);

    HttpResponse::Ok().json(serde_json::json!({
        "messages": msgs,
        "deal_room_id": deal_room_id,
        "next_after_id": next_cursor,
    }))
}
