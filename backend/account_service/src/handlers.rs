use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use sqlx::PgPool;
use crate::errors::error_response;
use crate::models::*;
use crate::service::AccountService;

fn get_account_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    req.extensions()
        .get::<auth_service::token::Claims>()
        .and_then(|c| c.sub.parse::<i64>().ok())
        .ok_or_else(|| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})))
}

// GET /api/v1/account/me
pub async fn get_me(req: HttpRequest, pool: web::Data<PgPool>) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.get_account_with_modules(account_id).await {
        Ok(account) => HttpResponse::Ok().json(account),
        Err(e) => error_response(e),
    }
}

// PATCH /api/v1/account/me
pub async fn update_me(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<UpdateAccountRequest>,
) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.update_account(account_id, body.into_inner()).await {
        Ok(account) => HttpResponse::Ok().json(AccountResponse::from(account)),
        Err(e) => error_response(e),
    }
}

// GET /api/v1/account/modules
pub async fn list_modules(req: HttpRequest, pool: web::Data<PgPool>) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.list_modules(account_id).await {
        Ok(modules) => {
            let summaries: Vec<ModuleSummary> = modules.into_iter().map(|m| ModuleSummary {
                code: m.module_code,
                is_active: m.is_active,
                activated_at: Some(m.activated_at),
            }).collect();
            HttpResponse::Ok().json(serde_json::json!({"modules": summaries}))
        }
        Err(e) => error_response(e),
    }
}

// POST /api/v1/account/modules/activate
pub async fn activate_module(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<ActivateModuleRequest>,
) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.activate_module(account_id, &body.module_code).await {
        Ok(module) => HttpResponse::Ok().json(serde_json::json!({
            "module_code": module.module_code,
            "is_active": module.is_active,
        })),
        Err(e) => error_response(e),
    }
}

// POST /api/v1/account/modules/deactivate
pub async fn deactivate_module(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<DeactivateModuleRequest>,
) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.deactivate_module(account_id, &body.module_code).await {
        Ok(module) => HttpResponse::Ok().json(serde_json::json!({
            "module_code": module.module_code,
            "is_active": module.is_active,
        })),
        Err(e) => error_response(e),
    }
}

// POST /api/v1/account/preferences
pub async fn update_preferences(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<UpdatePreferencesRequest>,
) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.update_preferences(account_id, &body.preferences).await {
        Ok(account) => {
            let modules = svc.list_modules(account_id).await.unwrap_or_default();
            let mut resp = AccountResponse::from(account);
            resp.modules = modules.into_iter().map(|m| ModuleSummary {
                code: m.module_code,
                is_active: m.is_active,
                activated_at: Some(m.activated_at),
            }).collect();
            HttpResponse::Ok().json(resp)
        }
        Err(e) => error_response(e),
    }
}

// GET /api/v1/account/permissions
pub async fn get_permissions(req: HttpRequest, pool: web::Data<PgPool>) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.get_permissions(account_id).await {
        Ok(permissions) => HttpResponse::Ok().json(PermissionResponse { permissions }),
        Err(e) => error_response(e),
    }
}

// GET /api/v1/account/sessions
pub async fn list_sessions(req: HttpRequest, pool: web::Data<PgPool>) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.list_sessions(account_id).await {
        Ok(sessions) => {
            let current_session_id: Option<uuid::Uuid> = req.headers().get("X-Session-Id")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<uuid::Uuid>().ok());

            let resp: Vec<SessionResponse> = sessions.into_iter().map(|s| SessionResponse {
                id: s.id,
                device_info: s.device_info,
                issued_at: s.issued_at,
                expires_at: s.expires_at,
                is_current: current_session_id == Some(s.id),
            }).collect();
            HttpResponse::Ok().json(serde_json::json!({"sessions": resp}))
        }
        Err(e) => error_response(e),
    }
}

// DELETE /api/v1/account/sessions/{id}
pub async fn revoke_session(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<uuid::Uuid>,
) -> impl actix_web::Responder {
    let account_id = match get_account_id(&req) {
        Ok(id) => id,
        Err(r) => return r,
    };
    let session_id = path.into_inner();
    let svc = AccountService::new(pool.get_ref().clone());
    match svc.revoke_session(session_id, account_id).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"revoked": true})),
        Err(e) => error_response(e),
    }
}
