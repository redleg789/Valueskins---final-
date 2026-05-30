use crate::models::*;
use crate::service::GuardianService;
use crate::permissions::PermissionService;
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

pub async fn invite_guardian(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<InviteGuardianRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = GuardianService::new((**pool).clone());
    match service.invite_guardian(user_id, &body).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            tracing::error!(user_id, error = %e, "Guardian invite failed");
            match e {
                GuardianError::AlreadyLinked => {
                    HttpResponse::Conflict().json(serde_json::json!({"error": "Guardian already linked"}))
                }
                GuardianError::InvalidStateTransition(msg) => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
                }
                _ => internal_error("Failed to invite guardian"),
            }
        }
    }
}

pub async fn accept_invite(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<AcceptInviteRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = GuardianService::new((**pool).clone());
    match service.accept_invite(user_id, &body).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            match e {
                GuardianError::InvalidInviteToken | GuardianError::InviteExpired => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": e.to_string()}))
                }
                GuardianError::SelfGuardian => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Cannot be your own guardian"}))
                }
                GuardianError::GuardianTooYoung => {
                    HttpResponse::BadRequest().json(serde_json::json!({"error": "Guardian must be 21 or older"}))
                }
                _ => internal_error("Failed to accept invite"),
            }
        }
    }
}

pub async fn complete_consent(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<(i64, i64, i64)>,  // relationship_id, consent_doc_id, guardian_doc_id
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let (relationship_id, consent_doc_id, guardian_doc_id) = path.into_inner();
    let service = GuardianService::new((**pool).clone());
    match service.complete_consent(relationship_id, user_id, consent_doc_id, guardian_doc_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            match e {
                GuardianError::RelationshipNotFound => HttpResponse::NotFound().json(serde_json::json!({"error": "Relationship not found"})),
                GuardianError::Forbidden(msg) => HttpResponse::Forbidden().json(serde_json::json!({"error": msg})),
                _ => internal_error("Failed to complete consent"),
            }
        }
    }
}

pub async fn update_permissions(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<UpdatePermissionsRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let relationship_id = path.into_inner();
    let perm_service = PermissionService::new((**pool).clone());
    match perm_service.update_permissions(relationship_id, user_id, &body.permissions).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            match e {
                GuardianError::Forbidden(msg) => HttpResponse::Forbidden().json(serde_json::json!({"error": msg})),
                GuardianError::PermissionDenied(msg) => HttpResponse::BadRequest().json(serde_json::json!({"error": msg})),
                _ => internal_error("Failed to update permissions"),
            }
        }
    }
}

pub async fn get_permissions(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    let perm_service = PermissionService::new((**pool).clone());
    match perm_service.get_permissions(path.into_inner()).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(_) => internal_error("Failed to get permissions"),
    }
}

pub async fn get_dashboard(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = GuardianService::new((**pool).clone());
    match service.get_guardian_dashboard(user_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(_) => internal_error("Failed to get dashboard"),
    }
}

pub async fn get_relationships(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = GuardianService::new((**pool).clone());
    // Try as guardian first, then as minor
    match service.get_guardian_dashboard(user_id).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(_) => {
            match service.get_minor_relationships(user_id).await {
                Ok(rels) => HttpResponse::Ok().json(rels),
                Err(_) => internal_error("Failed to get relationships"),
            }
        }
    }
}

pub async fn revoke_consent(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<RevokeConsentRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let relationship_id = path.into_inner();
    let service = GuardianService::new((**pool).clone());
    match service.revoke_consent(relationship_id, user_id, &body).await {
        Ok(resp) => HttpResponse::Ok().json(resp),
        Err(e) => {
            match e {
                GuardianError::RelationshipNotFound => HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"})),
                GuardianError::Forbidden(msg) => HttpResponse::Forbidden().json(serde_json::json!({"error": msg})),
                _ => internal_error("Failed to revoke consent"),
            }
        }
    }
}

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1/guardian")
            .route("/invite", web::post().to(invite_guardian))
            .route("/accept-invite", web::post().to(accept_invite))
            .route("/relationships", web::get().to(get_relationships))
            .route("/dashboard", web::get().to(get_dashboard))
            .route("/relationships/{id}/consent/{consent_doc_id}/{guardian_doc_id}", web::post().to(complete_consent))
            .route("/relationships/{id}/permissions", web::get().to(get_permissions))
            .route("/relationships/{id}/permissions", web::put().to(update_permissions))
            .route("/relationships/{id}/revoke", web::post().to(revoke_consent)),
    );
}
