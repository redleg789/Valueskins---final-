//! Admin API Handlers — leaderboard, platform stats, feature flags,
//! user management, GDPR requests, disputes, PII audit.
//! OPERATIONAL DASHBOARD: dispute resolution, analytics, commission controls
//!
//! All handlers enforce admin role via claims check.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use chrono::{DateTime, Utc};

/// Extract user_id from JWT claims (any authenticated user).
fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    crate::handlers::parse_authenticated_user_id(req)
}

/// Extract and validate admin role from JWT claims.
fn require_admin(req: &HttpRequest) -> Result<i64, HttpResponse> {
    let claims = req.extensions()
        .get::<auth_service::token::Claims>()
        .cloned()
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Authentication required"
        })))?;

    if claims.role != "admin" {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Admin access required"
        })));
    }

    claims.sub.parse::<i64>().map_err(|_| {
        HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid authentication token"
        }))
    })
}

#[derive(Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── Leaderboard ──────────────────────────────────────────────

pub async fn get_leaderboard(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let rows: Vec<(i64, String, Option<String>, Option<String>, Option<f64>, Option<i64>, Option<f64>, i64)> =
        match sqlx::query_as(
            "SELECT user_id, username, display_name, avatar_url,
                    reputation_score, total_deals, avg_rating, rank
             FROM creator_leaderboard
             ORDER BY rank
             LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch leaderboard");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to fetch leaderboard"
                }));
            }
        };

    let entries: Vec<serde_json::Value> = rows.iter().map(|r| {
        serde_json::json!({
            "user_id": r.0,
            "username": r.1,
            "display_name": r.2,
            "avatar_url": r.3,
            "reputation_score": r.4,
            "total_deals": r.5,
            "avg_rating": r.6,
            "rank": r.7,
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "leaderboard": entries,
        "pagination": { "limit": limit, "offset": offset }
    }))
}

// ── Platform Stats ───────────────────────────────────────────

pub async fn get_platform_stats(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let row: Option<(i64, i64, i64, f64, f64, i64, chrono::DateTime<chrono::Utc>)> =
        match sqlx::query_as(
            "SELECT total_users, total_personas, total_skins,
                    total_volume, total_revenue, total_deals, last_refreshed_at
             FROM platform_stats LIMIT 1"
        )
        .fetch_optional(pool.get_ref())
        .await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch platform stats");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to fetch stats"
                }));
            }
        };

    match row {
        Some(r) => HttpResponse::Ok().json(serde_json::json!({
            "total_users": r.0,
            "total_personas": r.1,
            "total_skins": r.2,
            "total_volume": r.3,
            "total_revenue": r.4,
            "total_deals": r.5,
            "last_refreshed_at": r.6.to_rfc3339(),
        })),
        None => HttpResponse::Ok().json(serde_json::json!({
            "total_users": 0, "total_personas": 0, "total_skins": 0,
            "total_volume": 0, "total_revenue": 0, "total_deals": 0,
        })),
    }
}

// ── Feature Flags ────────────────────────────────────────────

pub async fn list_feature_flags(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let flags: Vec<(i64, String, bool, Option<i32>, Option<String>, bool, Option<String>)> =
        match sqlx::query_as(
            "SELECT id, name, enabled, rollout_percentage, allowed_roles, shadow_mode, description
             FROM feature_flags WHERE deleted_at IS NULL ORDER BY name
             LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(f) => f,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch feature flags");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to fetch flags"
                }));
            }
        };

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM feature_flags WHERE deleted_at IS NULL")
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0);

    let entries: Vec<serde_json::Value> = flags.iter().map(|f| {
        serde_json::json!({
            "id": f.0, "name": f.1, "enabled": f.2,
            "rollout_percentage": f.3, "allowed_roles": f.4,
            "shadow_mode": f.5, "description": f.6,
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "flags": entries,
        "total": total,
        "pagination": { "limit": limit, "offset": offset }
    }))
}

#[derive(Deserialize)]
pub struct UpdateFlagRequest {
    pub enabled: Option<bool>,
    pub rollout_percentage: Option<i32>,
    pub shadow_mode: Option<bool>,
}

pub async fn update_feature_flag(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<String>,
    body: web::Json<UpdateFlagRequest>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let name = path.into_inner();

    if let Some(pct) = body.rollout_percentage {
        if !(0..=100).contains(&pct) {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "rollout_percentage must be 0-100"
            }));
        }
    }

    let result = sqlx::query(
        "UPDATE feature_flags SET
            enabled = COALESCE($2, enabled),
            rollout_percentage = COALESCE($3, rollout_percentage),
            shadow_mode = COALESCE($4, shadow_mode),
            updated_at = NOW()
         WHERE name = $1 AND deleted_at IS NULL"
    )
    .bind(&name)
    .bind(body.enabled)
    .bind(body.rollout_percentage)
    .bind(body.shadow_mode)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(flag = name.as_str(), "Feature flag updated");
            HttpResponse::Ok().json(serde_json::json!({ "updated": true }))
        }
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Flag not found" })),
        Err(e) => {
            tracing::error!(error = %e, "Failed to update flag");
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Update failed" }))
        }
    }
}

pub async fn kill_feature_flag(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<String>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let name = path.into_inner();

    let result = sqlx::query(
        "UPDATE feature_flags SET enabled = FALSE, rollout_percentage = 0, updated_at = NOW()
         WHERE name = $1 AND deleted_at IS NULL"
    )
    .bind(&name)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::warn!(flag = name.as_str(), "Feature flag KILLED");
            HttpResponse::Ok().json(serde_json::json!({ "killed": true }))
        }
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({ "error": "Flag not found" })),
        Err(e) => {
            tracing::error!(error = %e, "Failed to kill flag");
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Kill failed" }))
        }
    }
}

// ── Users Management ─────────────────────────────────────────

pub async fn list_users(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let users: Vec<(i64, String, Option<String>, String, bool, chrono::DateTime<chrono::Utc>)> =
        match sqlx::query_as(
            "SELECT id, username, display_name, role, is_active, created_at
             FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(u) => u,
            Err(e) => {
                tracing::error!(error = %e, "Failed to list users");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to list users"
                }));
            }
        };

    let entries: Vec<serde_json::Value> = users.iter().map(|u| {
        serde_json::json!({
            "id": u.0, "username": u.1, "display_name": u.2,
            "role": u.3, "is_active": u.4, "created_at": u.5.to_rfc3339(),
        })
    }).collect();

    // Count only active users to avoid COUNT(*) on full table at scale
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL")
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0);

    HttpResponse::Ok().json(serde_json::json!({
        "users": entries,
        "total": total,
        "pagination": { "limit": limit, "offset": offset }
    }))
}

pub async fn get_user(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> impl Responder {
    let admin_id = match require_admin(&req) { Ok(id) => id, Err(resp) => return resp };

    let user_id = path.into_inner();

    // Log PII access
    let pii_logger = shared::pii_audit::PiiAuditLogger::new(pool.get_ref().clone());
    let _ = pii_logger.log(
        admin_id, user_id, "read",
        "id,username,display_name,email,role,instagram_user_id",
        "Admin user detail view", None, None,
    ).await;

    let user: Option<(i64, String, Option<String>, Option<String>, String, bool, Option<String>, chrono::DateTime<chrono::Utc>)> =
        match sqlx::query_as(
            "SELECT id, username, display_name, avatar_url, role, is_active, instagram_user_id, created_at
             FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await {
            Ok(u) => u,
            Err(e) => {
                tracing::error!(error = %e, "Failed to get user");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to get user"
                }));
            }
        };

    match user {
        Some(u) => HttpResponse::Ok().json(serde_json::json!({
            "id": u.0, "username": u.1, "display_name": u.2,
            "avatar_url": u.3, "role": u.4, "is_active": u.5,
            "instagram_user_id": u.6, "created_at": u.7.to_rfc3339(),
        })),
        None => HttpResponse::NotFound().json(serde_json::json!({ "error": "User not found" })),
    }
}

pub async fn deactivate_user(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let user_id = path.into_inner();

    let result = sqlx::query(
        "UPDATE users SET is_active = FALSE WHERE id = $1 AND is_active = TRUE"
    )
    .bind(user_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            // Revoke all refresh tokens for deactivated user
            let refresh_svc = shared::refresh_tokens::RefreshTokenService::new(pool.get_ref().clone());
            let _ = refresh_svc.revoke_all_for_user(user_id).await;
            tracing::warn!(user_id = user_id, "User deactivated by admin");
            HttpResponse::Ok().json(serde_json::json!({ "deactivated": true }))
        }
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({ "error": "User not found or already inactive" })),
        Err(e) => {
            tracing::error!(error = %e, "Failed to deactivate user");
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Deactivation failed" }))
        }
    }
}

// ── GDPR Requests ────────────────────────────────────────────

pub async fn list_gdpr_requests(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let requests: Vec<(i64, i64, String, String, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)> =
        match sqlx::query_as(
            "SELECT id, user_id, status, scope, requested_at, processed_at
             FROM data_deletion_requests
             ORDER BY requested_at DESC
             LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "Failed to list GDPR requests");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to list requests"
                }));
            }
        };

    let entries: Vec<serde_json::Value> = requests.iter().map(|r| {
        serde_json::json!({
            "id": r.0, "user_id": r.1, "status": r.2,
            "scope": r.3, "requested_at": r.4.to_rfc3339(),
            "processed_at": r.5.map(|t| t.to_rfc3339()),
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "requests": entries,
        "pagination": { "limit": limit, "offset": offset }
    }))
}

pub async fn process_gdpr_request(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let request_id = path.into_inner();

    // Mark as processing
    let result = sqlx::query(
        "UPDATE data_deletion_requests SET status = 'processing'
         WHERE id = $1 AND status = 'pending'"
    )
    .bind(request_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(request_id = request_id, "GDPR request processing started");
            HttpResponse::Ok().json(serde_json::json!({
                "processing": true,
                "message": "Deletion processing started"
            }))
        }
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Request not found or already processed"
        })),
        Err(e) => {
            tracing::error!(error = %e, "Failed to process GDPR request");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Processing failed"
            }))
        }
    }
}

// ── Disputes ─────────────────────────────────────────────────

pub async fn list_disputes(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let disputes: Vec<(i64, i64, i64, String, String, Option<String>, chrono::DateTime<chrono::Utc>)> =
        match sqlx::query_as(
            "SELECT id, raised_by_user_id, deal_room_id, reason, status, resolution_notes, created_at
             FROM escrow_disputes
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(d) => d,
            Err(e) => {
                tracing::error!(error = %e, "Failed to list disputes");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to list disputes"
                }));
            }
        };

    let entries: Vec<serde_json::Value> = disputes.iter().map(|d| {
        serde_json::json!({
            "id": d.0, "raised_by_user_id": d.1, "deal_room_id": d.2,
            "reason": d.3, "status": d.4, "resolution_notes": d.5,
            "created_at": d.6.to_rfc3339(),
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "disputes": entries,
        "pagination": { "limit": limit, "offset": offset }
    }))
}

#[derive(Deserialize)]
pub struct ResolveDisputeRequest {
    pub resolution: String,
    pub notes: Option<String>,
}

pub async fn resolve_dispute(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<ResolveDisputeRequest>,
) -> impl Responder {
    let admin_id = match require_admin(&req) { Ok(id) => id, Err(resp) => return resp };

    let dispute_id = path.into_inner();

    let valid_resolutions = ["resolved_creator", "resolved_brand", "resolved_split", "dismissed"];
    if !valid_resolutions.contains(&body.resolution.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Resolution must be one of: resolved_creator, resolved_brand, resolved_split, dismissed"
        }));
    }

    let result = sqlx::query(
        "UPDATE escrow_disputes SET status = $2, resolved_by_user_id = $3, resolution_notes = $4, resolved_at = NOW()
         WHERE id = $1 AND status IN ('open', 'under_review')"
    )
    .bind(dispute_id)
    .bind(&body.resolution)
    .bind(admin_id)
    .bind(&body.notes)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(dispute_id = dispute_id, resolution = body.resolution.as_str(), "Dispute resolved");
            HttpResponse::Ok().json(serde_json::json!({ "resolved": true }))
        }
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Dispute not found or already resolved"
        })),
        Err(e) => {
            tracing::error!(error = %e, "Failed to resolve dispute");
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Resolution failed" }))
        }
    }
}

// ── PII Audit Log ────────────────────────────────────────────

pub async fn get_pii_audit_log(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let user_id = path.into_inner();
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let logs: Vec<(i64, i64, String, String, String, chrono::DateTime<chrono::Utc>)> =
        match sqlx::query_as(
            "SELECT accessor_user_id, target_user_id, action, fields_accessed, reason, accessed_at
             FROM pii_audit_log
             WHERE target_user_id = $1
             ORDER BY accessed_at DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(l) => l,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch PII audit log");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to fetch audit log"
                }));
            }
        };

    let entries: Vec<serde_json::Value> = logs.iter().map(|l| {
        serde_json::json!({
            "accessor_user_id": l.0, "target_user_id": l.1,
            "action": l.2, "fields_accessed": l.3,
            "reason": l.4, "accessed_at": l.5.to_rfc3339(),
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "audit_log": entries,
        "pagination": { "limit": limit, "offset": offset }
    }))
}

// ── API Keys Management ────────────────────────────────────────

pub async fn list_api_keys(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let keys: Vec<(i64, String, String, String, i32, Option<chrono::DateTime<chrono::Utc>>, bool)> =
        match sqlx::query_as(
            "SELECT ak.id, ak.key_prefix,
                    COALESCE(u.display_name, u.username),
                    ak.tier, ak.requests_per_minute,
                    ak.last_used_at, ak.is_active
             FROM api_keys ak
             JOIN users u ON u.id = ak.owner_user_id
             ORDER BY ak.id DESC
             LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(k) => k,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch API keys");
                return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to fetch API keys"}));
            }
        };

    let entries: Vec<serde_json::Value> = keys.iter().map(|k| {
        serde_json::json!({
            "id": k.0, "prefix": k.1, "owner": k.2, "tier": k.3,
            "requests_per_minute": k.4,
            "last_used": k.5.map(|d| d.to_rfc3339()),
            "is_active": k.6
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({
        "api_keys": entries,
        "pagination": { "limit": limit, "offset": offset }
    }))
}

// ── Contracts / Deal Rooms ────────────────────────────────────────

pub async fn list_my_contracts(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    let deals: Vec<(i64, String, String, i64, chrono::DateTime<chrono::Utc>,
                     Option<String>, Option<String>, String)> =
        match sqlx::query_as(
            "SELECT dr.id,
                    COALESCE(u_brand.display_name, u_brand.username),
                    dr.status,
                    COALESCE((SELECT amount_cents FROM offer_rounds WHERE deal_room_id = dr.id ORDER BY id DESC LIMIT 1), 0),
                    dr.created_at,
                    dr.brief_title,
                    dr.brief_campaign_type,
                    COALESCE(u_creator.display_name, u_creator.username)
             FROM deal_rooms dr
             JOIN users u_brand ON u_brand.id = dr.brand_user_id
             JOIN personas p ON p.id = dr.creator_persona_id
             JOIN users u_creator ON u_creator.id = p.owner_user_id
             WHERE p.owner_user_id = $1 OR dr.brand_user_id = $1
             ORDER BY dr.created_at DESC
             LIMIT 100"
        )
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await {
            Ok(d) => d,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch contracts");
                return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to fetch contracts"}));
            }
        };

    let contracts: Vec<serde_json::Value> = deals.iter().map(|d| {
        serde_json::json!({
            "id": d.0, "brand_name": d.1, "status": d.2,
            "amount_cents": d.3, "created_at": d.4.to_rfc3339(),
            "title": d.5, "campaign_type": d.6,
            "creator_name": d.7
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({ "contracts": contracts }))
}

// ── Platform Config ──────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlatformConfig {
    pub platform_name:                   String,
    pub platform_fee_percentage:         f64,
    pub min_payout_amount:               f64,
    pub max_payout_amount:               f64,
    pub payout_currency:                 String,
    pub notification_email_from:         String,
    pub support_contact_email:           String,
    pub terms_of_service_url:            String,
    pub privacy_policy_url:              String,
    pub max_creator_applications_per_day: i32,
    pub max_brand_opportunities_per_day:  i32,
    pub gdpr_compliance_days:            i32,
    pub enable_kyc:                      bool,
    pub kyc_provider:                    String,
    pub enable_csuite_advantage:         bool,
    pub csuite_enforcement_type:         String,
    pub enable_campaign_gating:          bool,
    pub enable_communities:              bool,
    pub enable_dispute_resolution:       bool,
    pub enable_brand_verification:       bool,
    pub maintenance_mode_enabled:        bool,
    pub maintenance_mode_message:        String,
    pub updated_at:                      chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePlatformConfigRequest {
    pub platform_name:                   Option<String>,
    pub platform_fee_percentage:         Option<f64>,
    pub min_payout_amount:               Option<f64>,
    pub max_payout_amount:               Option<f64>,
    pub payout_currency:                 Option<String>,
    pub notification_email_from:         Option<String>,
    pub support_contact_email:           Option<String>,
    pub terms_of_service_url:            Option<String>,
    pub privacy_policy_url:              Option<String>,
    pub max_creator_applications_per_day: Option<i32>,
    pub max_brand_opportunities_per_day:  Option<i32>,
    pub gdpr_compliance_days:            Option<i32>,
    pub enable_kyc:                      Option<bool>,
    pub kyc_provider:                    Option<String>,
    pub enable_csuite_advantage:         Option<bool>,
    pub csuite_enforcement_type:         Option<String>,
    pub enable_campaign_gating:          Option<bool>,
    pub enable_communities:              Option<bool>,
    pub enable_dispute_resolution:       Option<bool>,
    pub enable_brand_verification:       Option<bool>,
    pub maintenance_mode_enabled:        Option<bool>,
    pub maintenance_mode_message:        Option<String>,
}

pub async fn get_platform_config(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let admin_id = match require_admin(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };

    tracing::info!(admin_id, "Admin fetching platform config");

    match sqlx::query_as::<_, PlatformConfig>(
        "SELECT platform_name, platform_fee_percentage, min_payout_amount, max_payout_amount,
                payout_currency, notification_email_from, support_contact_email,
                terms_of_service_url, privacy_policy_url,
                max_creator_applications_per_day, max_brand_opportunities_per_day,
                gdpr_compliance_days, enable_kyc, kyc_provider,
                enable_csuite_advantage, csuite_enforcement_type,
                enable_campaign_gating, enable_communities,
                enable_dispute_resolution, enable_brand_verification,
                maintenance_mode_enabled, maintenance_mode_message, updated_at
         FROM platform_config WHERE id = 1"
    )
    .fetch_one(pool.get_ref())
    .await {
        Ok(config) => HttpResponse::Ok().json(config),
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch platform config");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to fetch config"}))
        }
    }
}

pub async fn update_platform_config(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    platform_cfg: web::Data<std::sync::Arc<shared::platform_config::PlatformConfigService>>,
    body: web::Json<UpdatePlatformConfigRequest>,
) -> impl Responder {
    let admin_id = match require_admin(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };

    tracing::info!(admin_id, "Admin updating platform config");

    // Build dynamic UPDATE — only set fields that were provided
    let result = sqlx::query(
        "UPDATE platform_config SET
            platform_name                    = COALESCE($1,  platform_name),
            platform_fee_percentage          = COALESCE($2,  platform_fee_percentage),
            min_payout_amount                = COALESCE($3,  min_payout_amount),
            max_payout_amount                = COALESCE($4,  max_payout_amount),
            payout_currency                  = COALESCE($5,  payout_currency),
            notification_email_from          = COALESCE($6,  notification_email_from),
            support_contact_email            = COALESCE($7,  support_contact_email),
            terms_of_service_url             = COALESCE($8,  terms_of_service_url),
            privacy_policy_url               = COALESCE($9,  privacy_policy_url),
            max_creator_applications_per_day = COALESCE($10, max_creator_applications_per_day),
            max_brand_opportunities_per_day  = COALESCE($11, max_brand_opportunities_per_day),
            gdpr_compliance_days             = COALESCE($12, gdpr_compliance_days),
            enable_kyc                       = COALESCE($13, enable_kyc),
            kyc_provider                     = COALESCE($14, kyc_provider),
            enable_csuite_advantage          = COALESCE($15, enable_csuite_advantage),
            csuite_enforcement_type          = COALESCE($16, csuite_enforcement_type),
            enable_campaign_gating           = COALESCE($17, enable_campaign_gating),
            enable_communities               = COALESCE($18, enable_communities),
            enable_dispute_resolution        = COALESCE($19, enable_dispute_resolution),
            enable_brand_verification        = COALESCE($20, enable_brand_verification),
            maintenance_mode_enabled         = COALESCE($21, maintenance_mode_enabled),
            maintenance_mode_message         = COALESCE($22, maintenance_mode_message),
            updated_by                       = $23
         WHERE id = 1"
    )
    .bind(&body.platform_name)
    .bind(body.platform_fee_percentage)
    .bind(body.min_payout_amount)
    .bind(body.max_payout_amount)
    .bind(&body.payout_currency)
    .bind(&body.notification_email_from)
    .bind(&body.support_contact_email)
    .bind(&body.terms_of_service_url)
    .bind(&body.privacy_policy_url)
    .bind(body.max_creator_applications_per_day)
    .bind(body.max_brand_opportunities_per_day)
    .bind(body.gdpr_compliance_days)
    .bind(body.enable_kyc)
    .bind(&body.kyc_provider)
    .bind(body.enable_csuite_advantage)
    .bind(&body.csuite_enforcement_type)
    .bind(body.enable_campaign_gating)
    .bind(body.enable_communities)
    .bind(body.enable_dispute_resolution)
    .bind(body.enable_brand_verification)
    .bind(body.maintenance_mode_enabled)
    .bind(&body.maintenance_mode_message)
    .bind(admin_id)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            // Invalidate the in-memory cache so maintenance mode / feature flags
            // take effect on the next request without waiting 30s.
            platform_cfg.invalidate().await;
            HttpResponse::Ok().json(serde_json::json!({"message": "Platform config updated"}))
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to update platform config");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to update config"}))
        }
    }
}

// ────────────────────────────────────────────────────────────────
// OPERATIONAL DASHBOARD ENDPOINTS (NEW)
// ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AdminDashboardMetrics {
    pub date: chrono::NaiveDate,
    pub daily_active_users: i64,
    pub new_creators: i64,
    pub new_brands: i64,
    pub deals_created: i64,
    pub deals_completed: i64,
    pub total_gmv_cents: i64,
    pub platform_revenue_cents: i64,
    pub pending_disputes: i64,
    pub pending_payouts: i64,
}

/// GET /admin/dashboard/metrics — Daily metrics snapshot
pub async fn get_dashboard_metrics(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let today = chrono::Local::now().naive_local().date();

    let dau: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE DATE(timestamp) = $1"
    )
    .bind(today)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let new_creators: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM personas WHERE DATE(created_at) = $1 AND persona_type = 'creator'"
    )
    .bind(today)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let new_brands: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM brands WHERE DATE(created_at) = $1"
    )
    .bind(today)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let deals_created: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM deal_rooms WHERE DATE(created_at) = $1"
    )
    .bind(today)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let deals_completed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM deal_rooms WHERE DATE(approved_at) = $1"
    )
    .bind(today)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let total_gmv_cents: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(CAST(reward_amount AS BIGINT)), 0)
           FROM opportunities o
           WHERE DATE(o.created_at) = $1"#
    )
    .bind(today)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let platform_revenue_cents = (total_gmv_cents as f64 * 0.05) as i64;

    let pending_disputes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'in_review')"
    )
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let pending_payouts: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM payout_ledger WHERE processor_status = 'pending'"
    )
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    let metrics = AdminDashboardMetrics {
        date: today,
        daily_active_users: dau,
        new_creators,
        new_brands,
        deals_created,
        deals_completed,
        total_gmv_cents,
        platform_revenue_cents,
        pending_disputes,
        pending_payouts,
    };

    HttpResponse::Ok().json(metrics)
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DisputeRecord {
    pub id: i64,
    pub deal_id: i64,
    pub filed_by_user_id: i64,
    pub dispute_type: String,
    pub description: String,
    pub status: String,
    pub filed_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct DisputeResolutionRequest {
    pub resolution: String,
    pub admin_notes: String,
}

/// Legacy dispute endpoint kept out of the main route tree.
pub async fn list_disputes_legacy(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    status: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let status_filter = status.get("status").map(|s| s.as_str());

    let disputes: Vec<DisputeRecord> = if let Some(s) = status_filter {
        sqlx::query_as(
            "SELECT id, deal_id, filed_by_user_id, dispute_type, description, status, filed_at, resolved_at FROM disputes WHERE status = $1 ORDER BY filed_at DESC LIMIT 100"
        )
        .bind(s)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as(
            "SELECT id, deal_id, filed_by_user_id, dispute_type, description, status, filed_at, resolved_at FROM disputes ORDER BY filed_at DESC LIMIT 100"
        )
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default()
    };

    HttpResponse::Ok().json(disputes)
}

/// Legacy dispute endpoint kept out of the main route tree.
pub async fn resolve_dispute_legacy(
    req: HttpRequest,
    path: web::Path<i64>,
    body: web::Json<DisputeResolutionRequest>,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let dispute_id = path.into_inner();

    sqlx::query(
        "UPDATE disputes SET status = 'resolved', resolution = $2, resolved_at = NOW() WHERE id = $1"
    )
    .bind(dispute_id)
    .bind(&body.resolution)
    .execute(pool.get_ref())
    .await
    .ok();

    HttpResponse::Ok().json(serde_json::json!({
        "status": "resolved",
        "dispute_id": dispute_id,
        "resolution": body.resolution,
        "resolved_at": Utc::now()
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommissionConfig {
    pub commission_rate_pct: f64,
    pub payment_model: String,
}

/// GET /admin/commissions — Get commission config
pub async fn get_commission_config(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let config: Option<(f64, String)> = sqlx::query_as(
        "SELECT commission_rate_pct, payment_model FROM platform_commission_config WHERE active = TRUE ORDER BY created_at DESC LIMIT 1"
    )
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten();

    let (rate, model) = config.unwrap_or((5.0, "brand_paid".to_string()));

    HttpResponse::Ok().json(CommissionConfig {
        commission_rate_pct: rate,
        payment_model: model,
    })
}

/// POST /admin/commissions — Update commission config
pub async fn update_commission_config(
    req: HttpRequest,
    body: web::Json<CommissionConfig>,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    if body.commission_rate_pct < 0.0 || body.commission_rate_pct > 50.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "commission_out_of_range"
        }));
    }

    sqlx::query("UPDATE platform_commission_config SET active = FALSE WHERE active = TRUE")
        .execute(pool.get_ref())
        .await
        .ok();

    sqlx::query(
        "INSERT INTO platform_commission_config (commission_rate_pct, payment_model, active, created_at) VALUES ($1, $2, TRUE, NOW())"
    )
    .bind(body.commission_rate_pct)
    .bind(&body.payment_model)
    .execute(pool.get_ref())
    .await
    .ok();

    HttpResponse::Ok().json(serde_json::json!({
        "status": "updated",
        "commission_rate_pct": body.commission_rate_pct
    }))
}

/// GET /admin/health — System health check
pub async fn health_check(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let db_ok = sqlx::query("SELECT 1").fetch_optional(pool.get_ref()).await.is_ok();

    HttpResponse::Ok().json(serde_json::json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "database": if db_ok { "ok" } else { "error" },
        "timestamp": Utc::now()
    }))
}

// ── Event Intelligence Dashboard ─────────────────────────────

pub async fn get_event_category_performance(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let rows: Vec<(String, String, i64, i64, f64, i64)> = match sqlx::query_as(
        "SELECT event_type, category, total_events, attendance_total, avg_conversion_rate::float8, repeat_attendance_total
         FROM admin_event_category_performance
         ORDER BY attendance_total DESC, avg_conversion_rate DESC"
    )
    .fetch_all(pool.get_ref())
    .await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch event category performance");
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to fetch event category performance" }));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "categories": rows.into_iter().map(|r| serde_json::json!({
            "event_type": r.0,
            "category": r.1,
            "total_events": r.2,
            "attendance_total": r.3,
            "avg_conversion_rate": r.4,
            "repeat_attendance_total": r.5
        })).collect::<Vec<_>>()
    }))
}

pub async fn get_event_city_performance(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let rows: Vec<(String, i64, i64, i64, f64)> = match sqlx::query_as(
        "SELECT city, total_events, attendance_total, tickets_sold_total, avg_conversion_rate::float8
         FROM admin_event_city_performance
         ORDER BY attendance_total DESC, avg_conversion_rate DESC"
    )
    .fetch_all(pool.get_ref())
    .await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch event city performance");
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to fetch event city performance" }));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "cities": rows.into_iter().map(|r| serde_json::json!({
            "city": r.0,
            "total_events": r.1,
            "attendance_total": r.2,
            "tickets_sold_total": r.3,
            "avg_conversion_rate": r.4
        })).collect::<Vec<_>>()
    }))
}

pub async fn get_event_host_performance(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let rows: Vec<(i64, i64, i64, i64, f64)> = match sqlx::query_as(
        "SELECT host_user_id, hosted_events, attendance_total, tickets_sold_total, avg_conversion_rate::float8
         FROM admin_event_host_performance
         ORDER BY attendance_total DESC, avg_conversion_rate DESC"
    )
    .fetch_all(pool.get_ref())
    .await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch event host performance");
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to fetch event host performance" }));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "hosts": rows.into_iter().map(|r| serde_json::json!({
            "host_user_id": r.0,
            "hosted_events": r.1,
            "attendance_total": r.2,
            "tickets_sold_total": r.3,
            "avg_conversion_rate": r.4
        })).collect::<Vec<_>>()
    }))
}

pub async fn get_event_network_map(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(100).min(500);
    let offset = params.offset.unwrap_or(0);

    let rows: Vec<(i64, i64, i64, f64)> = match sqlx::query_as(
        "SELECT node_a, node_b, shared_events, total_weight::float8
         FROM admin_event_network_overlap
         ORDER BY total_weight DESC, shared_events DESC
         LIMIT $1 OFFSET $2"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool.get_ref())
    .await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch event network map");
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to fetch event network map" }));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "edges": rows.into_iter().map(|r| serde_json::json!({
            "node_a": r.0,
            "node_b": r.1,
            "shared_events": r.2,
            "total_weight": r.3
        })).collect::<Vec<_>>(),
        "pagination": { "limit": limit, "offset": offset }
    }))
}

pub async fn list_event_report_runs(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    params: web::Query<PaginationParams>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    let rows: Vec<(i64, String, chrono::NaiveDate, chrono::NaiveDate, String, Option<DateTime<Utc>>, serde_json::Value)> =
        match sqlx::query_as(
            "SELECT id, report_type, period_start, period_end, status, generated_at, summary
             FROM event_report_runs
             ORDER BY period_end DESC
             LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch event report runs");
                return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to fetch event report runs" }));
            }
        };

    HttpResponse::Ok().json(serde_json::json!({
        "reports": rows.into_iter().map(|r| serde_json::json!({
            "id": r.0,
            "report_type": r.1,
            "period_start": r.2,
            "period_end": r.3,
            "status": r.4,
            "generated_at": r.5,
            "summary": r.6
        })).collect::<Vec<_>>(),
        "pagination": { "limit": limit, "offset": offset }
    }))
}

pub async fn get_event_report_detail(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> impl Responder {
    if let Err(resp) = require_admin(&req) { return resp; }

    let report_id = path.into_inner();
    let report: Option<(i64, String, chrono::NaiveDate, chrono::NaiveDate, String, Option<DateTime<Utc>>, serde_json::Value)> =
        match sqlx::query_as(
            "SELECT id, report_type, period_start, period_end, status, generated_at, summary
             FROM event_report_runs WHERE id = $1"
        )
        .bind(report_id)
        .fetch_optional(pool.get_ref())
        .await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "Failed to fetch event report detail");
                return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to fetch event report detail" }));
            }
        };

    let Some(report) = report else {
        return HttpResponse::NotFound().json(serde_json::json!({ "error": "Report not found" }));
    };

    let insights: Vec<(i64, String, String, serde_json::Value, f64)> = match sqlx::query_as(
        "SELECT id, insight_type, headline, supporting_data, priority_score
         FROM event_report_insights
         WHERE report_run_id = $1
         ORDER BY priority_score DESC, id ASC"
    )
    .bind(report_id)
    .fetch_all(pool.get_ref())
    .await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch event report insights");
            return HttpResponse::InternalServerError().json(serde_json::json!({ "error": "Failed to fetch event report insights" }));
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "report": {
            "id": report.0,
            "report_type": report.1,
            "period_start": report.2,
            "period_end": report.3,
            "status": report.4,
            "generated_at": report.5,
            "summary": report.6
        },
        "insights": insights.into_iter().map(|r| serde_json::json!({
            "id": r.0,
            "insight_type": r.1,
            "headline": r.2,
            "supporting_data": r.3,
            "priority_score": r.4
        })).collect::<Vec<_>>()
    }))
}
