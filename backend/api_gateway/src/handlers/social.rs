use actix_web::{web, HttpMessage, HttpRequest, HttpResponse, Responder};
use social_service::models::CreatePostRequest;
use social_service::service::SocialService;
use sqlx::PgPool;
use tracing::error;
use auth_service::token::Claims;

pub async fn create_post(
    req: web::Json<CreatePostRequest>,
    service: web::Data<SocialService>,
    http_req: HttpRequest,
    pool: web::Data<PgPool>,
) -> impl Responder {
    // Extract user_id from JWT claims injected by auth middleware
    let user_id = match http_req.extensions().get::<Claims>() {
        Some(claims) => match claims.sub.parse::<i64>() {
            Ok(id) => id,
            Err(_) => {
                return HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": "Invalid authentication token"
                }));
            }
        },
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Missing or invalid JWT token"
            }));
        }
    };

    // Query database to verify user owns the persona they're trying to post as
    let persona_id = req.author_persona_id;

    // Verify ownership: persona must exist AND be owned by authenticated user
    match sqlx::query_scalar::<_, Option<i64>>(
        "SELECT user_id FROM personas WHERE id = $1"
    )
    .bind(persona_id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(Some(owner_id))) if owner_id == user_id => {
            // User owns this persona, proceed with post creation
            match service.create_post(req.into_inner()).await {
                Ok(post) => HttpResponse::Ok().json(post),
                Err(e) => {
                    error!("Error creating post: {:?}", e);
                    HttpResponse::InternalServerError().finish()
                }
            }
        }
        Ok(_) => {
            // Persona doesn't exist or user doesn't own it
            HttpResponse::Forbidden().json(serde_json::json!({
                "error": "You do not own this persona"
            }))
        }
        Err(e) => {
            error!("Database error checking persona ownership: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}
