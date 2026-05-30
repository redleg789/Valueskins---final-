//! Brand Dashboard handler — aggregates opportunities, deal rooms,
//! and creator discovery data for the brand management page.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use sqlx::PgPool;

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    crate::handlers::parse_authenticated_user_id(req)
}

/// GET /brands/dashboard — brand dashboard: profile + aggregated metrics + campaigns + history
pub async fn get_brand_dashboard(req: HttpRequest, pool: web::Data<PgPool>) -> impl Responder {
    let user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    // Brand profile from users table
    let profile: Option<(i64, String, Option<String>, Option<String>, String)> =
        match sqlx::query_as(
            "SELECT id, username, COALESCE(display_name, username), avatar_url, role
             FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(pool.get_ref())
        .await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "brand dashboard: user query failed");
                return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to load profile"}));
            }
        };

    let profile = match profile {
        Some(p) => p,
        None => return HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"})),
    };

    // Aggregate metrics from opportunities
    let metrics: (i64, i64, i64, i64, f64) = sqlx::query_as(
        "SELECT
            COUNT(*) FILTER (WHERE status = 'open'),
            COUNT(*) FILTER (WHERE status = 'completed'),
            COUNT(*) FILTER (WHERE status NOT IN ('open','completed','cancelled')),
            (SELECT COUNT(*) FROM opportunity_applications oa
             JOIN opportunities o2 ON o2.id = oa.opportunity_id
             WHERE o2.brand_user_id = $1 AND oa.status = 'pending'),
            COALESCE(SUM(reward_amount) FILTER (WHERE status = 'completed'), 0)
         FROM opportunities WHERE brand_user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or((0, 0, 0, 0, 0.0));

    // Active campaigns (open + filled opportunities)
    let campaigns: Vec<(i64, String, Option<String>, String, f64, String, i64, chrono::DateTime<chrono::Utc>)> =
        sqlx::query_as(
            "SELECT o.id, o.title, o.description, o.category,
                    o.reward_amount, o.status,
                    (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id AND status = 'pending'),
                    o.created_at
             FROM opportunities o
             WHERE o.brand_user_id = $1
             ORDER BY o.created_at DESC
             LIMIT 50"
        )
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default();

    let campaign_entries: Vec<serde_json::Value> = campaigns.iter().map(|c| {
        serde_json::json!({
            "id": c.0, "title": c.1, "description": c.2,
            "category": c.3, "reward_amount_cents": (c.4 * 100.0) as i64,
            "status": c.5, "pending_applications": c.6,
            "created_at": c.7.to_rfc3339()
        })
    }).collect();

    // Completed deals history
    let history: Vec<(i64, String, f64, f64, chrono::DateTime<chrono::Utc>)> =
        sqlx::query_as(
            "SELECT cd.id, o.title, cd.total_amount, cd.creator_payout, cd.completed_at
             FROM completed_deals cd
             JOIN opportunities o ON o.id = cd.opportunity_id
             WHERE cd.brand_user_id = $1
             ORDER BY cd.completed_at DESC
             LIMIT 20"
        )
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default();

    let history_entries: Vec<serde_json::Value> = history.iter().map(|h| {
        serde_json::json!({
            "id": h.0, "title": h.1,
            "total_amount_cents": (h.2 * 100.0) as i64,
            "creator_payout_cents": (h.3 * 100.0) as i64,
            "completed_at": h.4.to_rfc3339()
        })
    }).collect();

    // Total unique creators worked with
    let creators_worked_with: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT creator_user_id) FROM completed_deals WHERE brand_user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    HttpResponse::Ok().json(serde_json::json!({
        "brand": {
            "id": profile.0,
            "username": profile.1,
            "display_name": profile.2,
            "avatar_url": profile.3,
            "role": profile.4
        },
        "metrics": {
            "active_campaigns": metrics.0,
            "completed_campaigns": metrics.1,
            "draft_campaigns": metrics.2,
            "pending_applications": metrics.3,
            "total_spent_cents": (metrics.4 * 100.0) as i64,
            "creators_worked_with": creators_worked_with
        },
        "campaigns": campaign_entries,
        "history": history_entries
    }))
}

/// GET /brands/discover — creator discovery for brands
pub async fn discover_creators(req: HttpRequest, pool: web::Data<PgPool>) -> impl Responder {
    let _user_id = match get_user_id(&req) { Ok(id) => id, Err(r) => return r };

    let creators: Vec<(i64, String, Option<String>, Option<String>, i64, Option<f64>, Option<i64>)> =
        sqlx::query_as(
            "SELECT u.id, u.username, u.display_name, u.avatar_url,
                    COALESCE(cl.rank, 0),
                    cl.reputation_score,
                    cl.total_deals
             FROM users u
             LEFT JOIN creator_leaderboard cl ON cl.user_id = u.id
             WHERE u.role = 'creator' AND u.is_active = TRUE
             ORDER BY cl.reputation_score DESC NULLS LAST
             LIMIT 50"
        )
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default();

    let entries: Vec<serde_json::Value> = creators.iter().map(|c| {
        serde_json::json!({
            "id": c.0, "username": c.1, "display_name": c.2,
            "avatar_url": c.3, "rank": c.4,
            "reputation_score": c.5, "total_deals": c.6
        })
    }).collect();

    HttpResponse::Ok().json(serde_json::json!({ "creators": entries }))
}
