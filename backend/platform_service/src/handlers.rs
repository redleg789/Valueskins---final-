use crate::models::*;
use crate::service::PlatformService;
use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use sqlx::PgPool;
use auth_service::token::Claims;

// ── Helper: Extract user ID from JWT ───────────────────────────────────

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    req.extensions()
        .get::<Claims>()
        .and_then(|c| c.sub.parse::<i64>().ok())
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})))
}

fn require_admin(req: &HttpRequest) -> Result<i64, HttpResponse> {
    let claims = req.extensions()
        .get::<Claims>()
        .cloned()
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})))?;

    if claims.role != "admin" {
        return Err(HttpResponse::Forbidden().json(serde_json::json!({"error": "Admin access required"})));
    }

    claims.sub.parse::<i64>()
        .ok()
        .ok_or_else(|| HttpResponse::InternalServerError().json(serde_json::json!({"error": "Invalid user ID"})))
}

// ── Helper: Map ServiceError to HttpResponse ───────────────────────────

fn map_error(err: ServiceError) -> HttpResponse {
    match err {
        ServiceError::NotFound => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"}))
        }
        ServiceError::Forbidden => {
            HttpResponse::Forbidden().json(serde_json::json!({"error": "Forbidden"}))
        }
        ServiceError::BadRequest(msg) => {
            HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
        }
        ServiceError::Conflict(msg) => {
            HttpResponse::Conflict().json(serde_json::json!({"error": msg}))
        }
        ServiceError::Database(msg) => {
            log::error!("Database error: {}", msg);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}

// ── Handlers ───────────────────────────────────────────────────────────

pub async fn get_csuite_settings(
    path: web::Path<String>,
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let _user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let platform_id = path.into_inner();
    let service = PlatformService::new((**pool).clone());

    match service.get_csuite_settings(&platform_id).await {
        Ok(settings) => {
            let response = CSuiteSettingsResponse {
                platform_id: settings.platform_id,
                enabled: settings.enabled,
                enforcement_type: settings.enforcement_type,
                level_boost_amount: settings.level_boost_amount,
                price_multiplier: settings.price_multiplier,
                title_whitelist: settings.title_whitelist,
                verification_strategy: settings.verification_strategy,
                available_verification_strategies: vec![
                    "self_reported",
                    "linkedin_oauth",
                    "admin_verified",
                    "hybrid",
                ],
            };
            HttpResponse::Ok().json(response)
        }
        Err(err) => map_error(err),
    }
}

pub async fn update_csuite_settings(
    path: web::Path<String>,
    req: HttpRequest,
    body: web::Json<UpdateCSuiteSettingsRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match require_admin(&req) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let platform_id = path.into_inner();
    let service = PlatformService::new((**pool).clone());
    match service
        .update_csuite_settings(&platform_id, body.into_inner(), user_id)
        .await
    {
        Ok(settings) => {
            let response = CSuiteSettingsResponse {
                platform_id: settings.platform_id,
                enabled: settings.enabled,
                enforcement_type: settings.enforcement_type,
                level_boost_amount: settings.level_boost_amount,
                price_multiplier: settings.price_multiplier,
                title_whitelist: settings.title_whitelist,
                verification_strategy: settings.verification_strategy,
                available_verification_strategies: vec![
                    "self_reported",
                    "linkedin_oauth",
                    "admin_verified",
                    "hybrid",
                ],
            };
            HttpResponse::Ok().json(response)
        }
        Err(err) => map_error(err),
    }
}

pub async fn add_title(
    path: web::Path<i64>,
    req: HttpRequest,
    body: web::Json<AddTitleRequest>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let persona_id = path.into_inner();
    let service = PlatformService::new((**pool).clone());

    match service
        .add_title(persona_id, body.into_inner(), user_id)
        .await
    {
        Ok(title) => {
            let response = PersonaTitleResponse {
                id: title.id,
                title: title.title,
                company: title.company,
                verified_via: title.verified_via,
                verified_at: title.verified_at,
                is_verified: title.is_verified,
                expires_at: title.expires_at,
                is_active: title.is_active,
                created_at: title.created_at,
            };
            HttpResponse::Created().json(response)
        }
        Err(err) => map_error(err),
    }
}

pub async fn list_titles(
    path: web::Path<i64>,
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let _user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let persona_id = path.into_inner();
    let service = PlatformService::new((**pool).clone());

    match service.list_titles(persona_id).await {
        Ok(titles) => {
            let response: Vec<PersonaTitleResponse> = titles
                .into_iter()
                .map(|t| PersonaTitleResponse {
                    id: t.id,
                    title: t.title,
                    company: t.company,
                    verified_via: t.verified_via,
                    verified_at: t.verified_at,
                    is_verified: t.is_verified,
                    expires_at: t.expires_at,
                    is_active: t.is_active,
                    created_at: t.created_at,
                })
                .collect();
            HttpResponse::Ok().json(response)
        }
        Err(err) => map_error(err),
    }
}

pub async fn verify_title(
    path: web::Path<i64>,
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match require_admin(&req) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let title_id = path.into_inner();
    let service = PlatformService::new((**pool).clone());

    match service.verify_title(title_id, user_id).await {
        Ok(title) => {
            let response = PersonaTitleResponse {
                id: title.id,
                title: title.title,
                company: title.company,
                verified_via: title.verified_via,
                verified_at: title.verified_at,
                is_verified: title.is_verified,
                expires_at: title.expires_at,
                is_active: title.is_active,
                created_at: title.created_at,
            };
            HttpResponse::Ok().json(response)
        }
        Err(err) => map_error(err),
    }
}

pub async fn remove_title(
    path: web::Path<i64>,
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let title_id = path.into_inner();
    let service = PlatformService::new((**pool).clone());

    match service.remove_title(title_id, user_id).await {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(err) => map_error(err),
    }
}

pub async fn get_title_audit_log(
    path: web::Path<i64>,
    req: HttpRequest,
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let _user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(response) => return response,
    };

    let persona_id = path.into_inner();
    let limit = query
        .get("limit")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(100);
    let offset = query
        .get("offset")
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    let service = PlatformService::new((**pool).clone());

    match service.get_title_audit_log(persona_id, limit, offset).await {
        Ok(audit_log) => {
            let response: Vec<AuditLogEntry> = audit_log
                .into_iter()
                .map(|a| AuditLogEntry {
                    id: a.id,
                    persona_id: a.persona_id,
                    user_id: a.user_id,
                    old_title: a.old_title,
                    new_title: a.new_title,
                    changed_by: a.changed_by,
                    reason: a.reason,
                    changed_at: a.changed_at,
                })
                .collect();
            HttpResponse::Ok().json(response)
        }
        Err(err) => map_error(err),
    }
}
