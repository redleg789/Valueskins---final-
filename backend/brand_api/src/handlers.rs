//! Brand API HTTP Handlers
//! 
//! Public API endpoints for brands to integrate with Valueskins

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use sqlx::PgPool;
use log::{info, error};
use crate::models::*;
use crate::service::BrandApiService;
use crate::auth::validate_api_key;

/// GET /api/v1/verify/{persona_id}/{profession_id}
/// 
/// Verifies a creator's level - PRIMARY API for brands
pub async fn verify_creator(
    pool: web::Data<PgPool>,
    path: web::Path<(i64, i64)>,
    req: HttpRequest,
) -> impl Responder {
    let api_key = match extract_api_key(&req) {
        Some(key) => key,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Missing API key. Include X-API-Key header."
        })),
    };
    
    match validate_api_key(pool.get_ref(), &api_key).await {
        Ok(brand_id) => {
            info!("Brand {} verifying creator", brand_id);
        }
        Err(e) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": e.to_string()
            }));
        }
    }
    
    let (persona_id, profession_id) = path.into_inner();
    let service = BrandApiService::new(pool.get_ref().clone());
    
    match service.verify_creator(persona_id, profession_id).await {
        Ok(verification) => HttpResponse::Ok().json(verification),
        Err(e) => {
            error!("Verification failed: {:?}", e);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Creator or profession not found"
            }))
        }
    }
}

/// GET /api/v1/creators
/// 
/// Search for creators by criteria
pub async fn search_creators(
    pool: web::Data<PgPool>,
    query: web::Query<CreatorSearchRequest>,
    req: HttpRequest,
) -> impl Responder {
    let api_key = match extract_api_key(&req) {
        Some(key) => key,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Missing API key"
        })),
    };
    
    if let Err(e) = validate_api_key(pool.get_ref(), &api_key).await {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": e.to_string()
        }));
    }
    
    let service = BrandApiService::new(pool.get_ref().clone());
    
    match service.search_creators(query.into_inner()).await {
        Ok(results) => HttpResponse::Ok().json(serde_json::json!({
            "creators": results,
            "count": results.len()
        })),
        Err(e) => {
            error!("Search failed: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /api/v1/verify/batch
/// 
/// Batch verify multiple creators
#[derive(serde::Deserialize)]
pub struct BatchVerifyRequest {
    pub creators: Vec<BatchVerifyItem>,
}

#[derive(serde::Deserialize)]
pub struct BatchVerifyItem {
    pub persona_id: i64,
    pub profession_id: i64,
}

pub async fn batch_verify(
    pool: web::Data<PgPool>,
    body: web::Json<BatchVerifyRequest>,
    req: HttpRequest,
) -> impl Responder {
    let api_key = match extract_api_key(&req) {
        Some(key) => key,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Missing API key"
        })),
    };
    
    if let Err(e) = validate_api_key(pool.get_ref(), &api_key).await {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": e.to_string()
        }));
    }
    
    if body.creators.len() > 100 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Maximum 100 creators per batch"
        }));
    }
    
    let service = BrandApiService::new(pool.get_ref().clone());
    let requests: Vec<(i64, i64)> = body.creators
        .iter()
        .map(|c| (c.persona_id, c.profession_id))
        .collect();
    
    match service.batch_verify(requests).await {
        Ok(results) => HttpResponse::Ok().json(serde_json::json!({
            "verifications": results,
            "count": results.len()
        })),
        Err(e) => {
            error!("Batch verify failed: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /api/v1/badge/{persona_id}/{profession_id}
/// 
/// Get embeddable badge code
pub async fn get_badge(
    pool: web::Data<PgPool>,
    path: web::Path<(i64, i64)>,
    req: HttpRequest,
) -> impl Responder {
    let api_key = match extract_api_key(&req) {
        Some(key) => key,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Missing API key"
        })),
    };
    
    if let Err(e) = validate_api_key(pool.get_ref(), &api_key).await {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": e.to_string()
        }));
    }
    
    let (persona_id, profession_id) = path.into_inner();
    let service = BrandApiService::new(pool.get_ref().clone());
    
    match service.generate_embeddable_badge(persona_id, profession_id).await {
        Ok(badge) => HttpResponse::Ok().json(badge),
        Err(e) => {
            error!("Badge generation failed: {:?}", e);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Creator or profession not found"
            }))
        }
    }
}

/// GET /api/v1/badge/{persona_id}/{profession_id}.svg
/// 
/// Returns SVG badge image (public, no auth required)
pub async fn get_badge_svg(
    pool: web::Data<PgPool>,
    path: web::Path<(i64, i64)>,
) -> impl Responder {
    let (persona_id, profession_id) = path.into_inner();
    
    // Get level for styling
    let level: Option<i32> = sqlx::query_scalar(
        "SELECT level FROM persona_professions WHERE persona_id = $1 AND profession_id = $2"
    )
    .bind(persona_id)
    .bind(profession_id)
    .fetch_optional(pool.get_ref())
    .await
    .ok()
    .flatten();
    
    let level = level.unwrap_or(1);
    let (color, glow) = level_colors(level);
    
    let svg = format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="120" height="28" viewBox="0 0 120 28">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:{color}"/>
      <stop offset="100%" style="stop-color:{glow}"/>
    </linearGradient>
  </defs>
  <rect width="120" height="28" rx="6" fill="url(#bg)"/>
  <text x="10" y="18" font-family="Arial, sans-serif" font-size="11" fill="white" font-weight="bold">
    VALUESKINS
  </text>
  <text x="85" y="18" font-family="Arial, sans-serif" font-size="11" fill="white">
    L{level}
  </text>
  <circle cx="105" cy="14" r="6" fill="white" fill-opacity="0.3"/>
  <text x="105" y="17" font-family="Arial, sans-serif" font-size="8" fill="white" text-anchor="middle">✓</text>
</svg>"#);
    
    HttpResponse::Ok()
        .content_type("image/svg+xml")
        .insert_header(("Cache-Control", "public, max-age=3600"))
        .body(svg)
}

/// GET /api/v1/usage
/// 
/// Get API usage stats for the authenticated brand
pub async fn get_usage_stats(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> impl Responder {
    let api_key = match extract_api_key(&req) {
        Some(key) => key,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Missing API key"
        })),
    };
    
    let brand_id = match validate_api_key(pool.get_ref(), &api_key).await {
        Ok(id) => id,
        Err(e) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": e.to_string()
            }));
        }
    };
    
    let service = BrandApiService::new(pool.get_ref().clone());
    
    match service.get_usage_stats(brand_id).await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(e) => {
            error!("Usage stats failed: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /api/v1/professions
/// 
/// List all available professions (public)
pub async fn list_professions(
    pool: web::Data<PgPool>,
) -> impl Responder {
    let result = sqlx::query_as::<_, (i64, String, String, String)>(
        r#"
        SELECT id, name, category, description
        FROM professions
        WHERE is_active = true
        ORDER BY category, name
        "#
    )
    .fetch_all(pool.get_ref())
    .await;
    
    match result {
        Ok(professions) => {
            let data: Vec<serde_json::Value> = professions.into_iter().map(|p| {
                serde_json::json!({
                    "id": p.0,
                    "name": p.1,
                    "category": p.2,
                    "description": p.3
                })
            }).collect();
            HttpResponse::Ok().json(serde_json::json!({
                "professions": data
            }))
        }
        Err(e) => {
            error!("List professions failed: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// Helper functions

fn extract_api_key(req: &HttpRequest) -> Option<String> {
    req.headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

fn level_colors(level: i32) -> (&'static str, &'static str) {
    match level {
        1 => ("#6b7280", "#4b5563"), // Gray
        2 => ("#22c55e", "#16a34a"), // Green
        3 => ("#3b82f6", "#2563eb"), // Blue
        4 => ("#a855f7", "#9333ea"), // Purple
        5 => ("#f59e0b", "#d97706"), // Gold
        _ => ("#6b7280", "#4b5563"),
    }
}
