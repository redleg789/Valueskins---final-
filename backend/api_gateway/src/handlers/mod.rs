pub mod auth;
pub mod auth_ext;
pub mod social;
pub mod ai;
pub mod analytics;
pub mod recommendation;
pub mod persona;
pub mod admin;
pub mod equity;
pub mod insurance;
pub mod collective;
pub mod mediakit;
pub mod verification;
pub mod brand;
pub mod messages;

use actix_web::{HttpMessage, HttpRequest, HttpResponse};

pub(crate) fn parse_authenticated_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    let extensions = req.extensions();
    let claims = extensions
        .get::<auth_service::token::Claims>()
        .ok_or_else(|| {
            HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Authentication required"
            }))
        })?;

    claims.sub.parse::<i64>().map_err(|_| {
        HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid authentication token"
        }))
    })
}
