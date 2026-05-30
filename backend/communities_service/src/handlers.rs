//! Community HTTP Handlers

use actix_web::{web, HttpRequest, HttpResponse, HttpMessage, Responder};
use sqlx::PgPool;
use log::{info, error};
use crate::models::*;
use crate::service::{CommunityService, ServiceError};

// ── Helper Functions ───────────────────────────────────────────────────

fn get_user_info(req: &HttpRequest) -> Option<(i64, Option<i64>)> {
    let claims = req.extensions().get::<auth_service::token::Claims>()?.clone();
    let user_id: i64 = claims.sub.parse().ok()?;
    Some((user_id, claims.persona_id))
}

// ── Community Management ───────────────────────────────────────────────

/// POST /communities
pub async fn create_community(
    pool: web::Data<PgPool>,
    body: web::Json<CreateCommunityRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let svc = CommunityService::new(pool.get_ref().clone());
    match svc.create_community(user_id, body.into_inner()).await {
        Ok(id) => {
            info!("Created community {}", id);
            HttpResponse::Created().json(serde_json::json!({ "community_id": id }))
        }
        Err(e) => {
            error!("create_community: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /communities
pub async fn list_communities(
    pool: web::Data<PgPool>,
    query: web::Query<std::collections::HashMap<String, String>>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let search = query.get("search").cloned();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.list_communities(user_id, search).await {
        Ok(communities) => HttpResponse::Ok().json(serde_json::json!({ "communities": communities })),
        Err(e) => {
            error!("list_communities: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /communities/{id}
pub async fn get_community(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let id = path.into_inner();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.get_community(id, user_id).await {
        Ok(comm) => HttpResponse::Ok().json(comm),
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(e) => {
            error!("get_community: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /communities/{id}/join
pub async fn join_community(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let community_id = path.into_inner();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.join_community(community_id, user_id).await {
        Ok(_) => {
            info!("User {} joined community {}", user_id, community_id);
            HttpResponse::Ok().json(serde_json::json!({ "message": "Joined community" }))
        }
        Err(ServiceError::NotEligible { reason }) => {
            HttpResponse::Forbidden().json(serde_json::json!({ "error": reason }))
        }
        Err(ServiceError::NotFound) => HttpResponse::NotFound().finish(),
        Err(e) => {
            error!("join_community: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /communities/{id}/leave
pub async fn leave_community(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let community_id = path.into_inner();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.leave_community(community_id, user_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Left community" })),
        Err(ServiceError::OwnerCannotLeave) => {
            HttpResponse::UnprocessableEntity().json(serde_json::json!({
                "error": "Community owner cannot leave"
            }))
        }
        Err(ServiceError::NotMember) => HttpResponse::Forbidden().finish(),
        Err(e) => {
            error!("leave_community: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /communities/{id}/members
pub async fn list_members(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let community_id = path.into_inner();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.list_members(community_id, user_id).await {
        Ok(members) => HttpResponse::Ok().json(serde_json::json!({ "members": members })),
        Err(ServiceError::Forbidden) => HttpResponse::Forbidden().finish(),
        Err(e) => {
            error!("list_members: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// ── Posts ──────────────────────────────────────────────────────────────

/// POST /communities/{id}/posts
pub async fn create_post(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    body: web::Json<CreatePostRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let community_id = path.into_inner();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.create_post(community_id, user_id, body.into_inner()).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({ "post_id": id })),
        Err(ServiceError::NotMember) => HttpResponse::Forbidden().finish(),
        Err(ServiceError::Forbidden) => {
            HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Only admin/owner can create announcements"
            }))
        }
        Err(e) => {
            error!("create_post: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /communities/{id}/posts
pub async fn list_posts(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    query: web::Query<std::collections::HashMap<String, String>>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let community_id = path.into_inner();
    let limit = query.get("limit").and_then(|s| s.parse().ok()).unwrap_or(50);
    let offset = query.get("offset").and_then(|s| s.parse().ok()).unwrap_or(0);

    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.list_posts(community_id, user_id, limit, offset).await {
        Ok(posts) => HttpResponse::Ok().json(serde_json::json!({ "posts": posts })),
        Err(ServiceError::Forbidden) => HttpResponse::Forbidden().finish(),
        Err(e) => {
            error!("list_posts: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /communities/posts/{id}/like
pub async fn like_post(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let post_id = path.into_inner();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.like_post(post_id, user_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Liked" })),
        Err(ServiceError::NotMember) => HttpResponse::Forbidden().json(serde_json::json!({ "error": "Must be a community member to like posts" })),
        Err(e) => {
            error!("like_post: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// POST /communities/posts/{id}/unlike
pub async fn unlike_post(
    pool: web::Data<PgPool>,
    path: web::Path<i64>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let post_id = path.into_inner();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.unlike_post(post_id, user_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Unliked" })),
        Err(ServiceError::NotMember) => HttpResponse::Forbidden().json(serde_json::json!({ "error": "Must be a community member to unlike posts" })),
        Err(e) => {
            error!("unlike_post: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// ── Pricing (Meta Admin) ───────────────────────────────────────────────

/// POST /communities/admin/pricing
pub async fn set_pricing(
    pool: web::Data<PgPool>,
    body: web::Json<SetPricingRequest>,
    req: HttpRequest,
) -> impl Responder {
    let (user_id, _) = match get_user_info(&req) {
        Some(i) => i,
        None => return HttpResponse::Unauthorized().finish(),
    };

    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.set_pricing(user_id, body.into_inner()).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({ "message": "Pricing updated" })),
        Err(ServiceError::Forbidden) => {
            HttpResponse::Forbidden().json(serde_json::json!({ "error": "Admin access required" }))
        }
        Err(ServiceError::NotFound) => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": "Profession not found" }))
        }
        Err(e) => {
            error!("set_pricing: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

/// GET /communities/admin/pricing
pub async fn get_pricing(
    pool: web::Data<PgPool>,
    query: web::Query<std::collections::HashMap<String, String>>,
    _req: HttpRequest,
) -> impl Responder {
    let profession = query.get("profession").cloned();
    let svc = CommunityService::new(pool.get_ref().clone());

    match svc.get_pricing(profession).await {
        Ok(pricing) => HttpResponse::Ok().json(serde_json::json!({ "pricing": pricing })),
        Err(e) => {
            error!("get_pricing: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}
