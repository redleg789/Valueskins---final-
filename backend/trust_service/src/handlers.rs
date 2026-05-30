use crate::models::*;
use crate::service::TrustService;
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

fn internal_error(msg: &str) -> HttpResponse {
    HttpResponse::InternalServerError().json(serde_json::json!({"error": msg}))
}

pub async fn get_trust_score(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = TrustService::new((**pool).clone());
    match service.get_trust_score(user_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(TrustError::ProfileNotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Profile not found"}))
        }
        Err(_) => internal_error("Failed to get trust score"),
    }
}

pub async fn record_event(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<RecordEventRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = TrustService::new((**pool).clone());
    match service.record_event(user_id, &body).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            match e {
                TrustError::ProfileNotFound => {
                    HttpResponse::NotFound().json(serde_json::json!({"error": "Profile not found"}))
                }
                TrustError::ScoreOutOfRange(msg) | TrustError::InvalidCategory(msg) => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
                }
                _ => internal_error("Failed to record event"),
            }
        }
    }
}

pub async fn get_tiers(
    _req: HttpRequest,
) -> HttpResponse {
    HttpResponse::Ok().json(TrustService::get_all_tiers())
}

pub async fn get_my_trust_profile(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = TrustService::new((**pool).clone());

    // Get trust score
    let score = match service.get_trust_score(user_id).await {
        Ok(s) => s,
        Err(TrustError::ProfileNotFound) => {
            return HttpResponse::NotFound().json(serde_json::json!({"error": "Profile not found"}));
        }
        Err(_) => return internal_error("Failed to get trust score"),
    };

    // Get active badges
    let badges: Vec<serde_json::Value> = match sqlx::query_as::<_, (String, String, String, String, String, Option<String>, bool)>(
        r#"SELECT b.badge_code, b.display_name, b.description, b.category::text,
                  b.badge_type, b.icon_url, ub.is_visible
           FROM user_badges ub
           JOIN badges b ON b.id = ub.badge_id
           WHERE ub.user_id = $1 AND ub.is_active = TRUE
           ORDER BY b.priority DESC"#,
    )
    .bind(user_id)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(rows) => rows
            .into_iter()
            .map(|(code, name, desc, category, badge_type, icon, visible)| {
                serde_json::json!({
                    "badge_code": code,
                    "display_name": name,
                    "description": desc,
                    "category": category,
                    "badge_type": badge_type,
                    "icon_url": icon,
                    "is_visible": visible,
                })
            })
            .collect(),
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch user badges");
            return internal_error("Failed to fetch badges");
        }
    };

    // Get tier info
    let tier_info = TrustService::get_tier_info(score.overall_score);

    HttpResponse::Ok().json(serde_json::json!({
        "user_id": user_id,
        "trust_score": score.overall_score,
        "trust_tier": score.trust_tier,
        "tier_info": {
            "label": tier_info.label,
            "color": tier_info.color,
            "score_range": [tier_info.score_range.0, tier_info.score_range.1],
        },
        "risk_level": score.risk_level,
        "dimensions": score.dimensions,
        "badges": badges,
        "recent_events": score.recent_events,
        "calculated_at": score.calculated_at,
    }))
}

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1/trust")
            .route("/score", web::get().to(get_trust_score))
            .route("/events", web::post().to(record_event))
            .route("/tiers", web::get().to(get_tiers)),
    );
}
