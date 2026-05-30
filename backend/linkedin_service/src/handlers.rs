use crate::models::*;
use crate::service::LinkedInService;
use actix_web::{web, HttpRequest, HttpResponse};
use auth_service::token::Claims;
use sqlx::PgPool;

// ── Auth Helper ───────────────────────────────────────────────────────

fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    use actix_web::HttpMessage;

    req.extensions()
        .get::<Claims>()
        .cloned()
        .ok_or_else(|| {
            HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "Unauthorized"}))
        })
        .and_then(|claims| {
            claims.sub.parse::<i64>().map_err(|_| {
                HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "Invalid user ID in token"}))
            })
        })
}

fn map_error(err: ServiceError) -> HttpResponse {
    match err {
        ServiceError::NotFound => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"}))
        }
        ServiceError::Forbidden => {
            HttpResponse::Forbidden().json(serde_json::json!({"error": "Forbidden"}))
        }
        ServiceError::Conflict(msg) => {
            HttpResponse::Conflict().json(serde_json::json!({"error": msg}))
        }
        ServiceError::Validation(msg) => {
            HttpResponse::BadRequest().json(serde_json::json!({"error": msg}))
        }
        ServiceError::Database(e) => {
            tracing::error!(error = %e, "LinkedIn service database error");
            HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "Internal server error"}))
        }
    }
}

// ── Profile Handlers ──────────────────────────────────────────────────

pub async fn link_profile(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<LinkLinkedInRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.link_profile(user_id, body.into_inner()).await {
        Ok(profile) => HttpResponse::Ok().json(profile),
        Err(e) => map_error(e),
    }
}

pub async fn get_profile(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.get_profile(user_id).await {
        Ok(profile) => HttpResponse::Ok().json(profile),
        Err(e) => map_error(e),
    }
}

pub async fn set_visibility(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<UpdateVisibilityRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.set_visibility(user_id, body.is_public).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => map_error(e),
    }
}

pub async fn unlink_profile(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.unlink_profile(user_id).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => map_error(e),
    }
}

// ── Connection Handlers ───────────────────────────────────────────────

pub async fn send_connection_request(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<SendConnectionRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.send_connection_request(user_id, body.connected_user_id).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => map_error(e),
    }
}

pub async fn respond_to_connection(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<RespondConnectionRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.respond_to_connection(user_id, body.user_id, body.accept).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => map_error(e),
    }
}

pub async fn list_connections(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.list_connections(user_id).await {
        Ok(conns) => HttpResponse::Ok().json(conns),
        Err(e) => map_error(e),
    }
}

pub async fn list_connections_with_shared_skins(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.list_connections_with_shared_skins(user_id).await {
        Ok(conns) => HttpResponse::Ok().json(conns),
        Err(e) => map_error(e),
    }
}

pub async fn list_pending_requests(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.list_pending_requests(user_id).await {
        Ok(reqs) => HttpResponse::Ok().json(reqs),
        Err(e) => map_error(e),
    }
}

// ── Recommendation Handlers ───────────────────────────────────────────

pub async fn give_recommendation(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<GiveRecommendationRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.give_recommendation(user_id, body.into_inner()).await {
        Ok(rec) => HttpResponse::Created().json(rec),
        Err(e) => map_error(e),
    }
}

pub async fn get_recommendations(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
) -> HttpResponse {
    let _viewer_user_id = get_user_id(&req).ok();
    let recipient_user_id = path.into_inner();

    // Optional query parameter: ?profession=Software+Engineer
    let query = web::Query::<std::collections::HashMap<String, String>>::from_query(
        req.query_string(),
    )
    .ok();

    let profession = query
        .as_ref()
        .and_then(|q| q.get("profession"))
        .map(|s| s.as_str());

    let service = LinkedInService::new((**pool).clone());
    match service.get_recommendations(recipient_user_id, profession).await {
        Ok(recs) => HttpResponse::Ok().json(recs),
        Err(e) => map_error(e),
    }
}

// ── Invitation Handlers ───────────────────────────────────────────────

pub async fn invite_to_community(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<InviteToCommunityRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.invite_to_community(user_id, body.into_inner()).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => map_error(e),
    }
}

pub async fn list_pending_invitations(
    req: HttpRequest,
    pool: web::Data<PgPool>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let service = LinkedInService::new((**pool).clone());
    match service.list_pending_invitations(user_id).await {
        Ok(invitations) => HttpResponse::Ok().json(invitations),
        Err(e) => map_error(e),
    }
}

pub async fn respond_to_invitation(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<RespondInvitationRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(&req) {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let invitation_id = path.into_inner();

    let service = LinkedInService::new((**pool).clone());
    match service.respond_to_invitation(user_id, invitation_id, body.accept).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({"success": true})),
        Err(e) => map_error(e),
    }
}
