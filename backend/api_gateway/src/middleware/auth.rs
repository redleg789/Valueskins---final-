use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpResponse,
    body::EitherBody,
};
use futures_util::future::LocalBoxFuture;
use std::{future::{ready, Ready}, rc::Rc};
use auth_service::token::TokenManager;
use shared::logging::middleware::LogUserId;

fn extract_bearer_token(header: Option<&str>) -> Option<&str> {
    header
        .and_then(|h| h.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|t| !t.is_empty())
}

#[cfg(test)]
mod tests {
    use super::extract_bearer_token;

    #[test]
    fn extracts_valid_bearer_token() {
        assert_eq!(extract_bearer_token(Some("Bearer abc123")), Some("abc123"));
        assert_eq!(extract_bearer_token(Some("Bearer   xyz")), Some("xyz"));
    }

    #[test]
    fn rejects_invalid_or_empty_bearer_token() {
        assert_eq!(extract_bearer_token(Some("Basic abc123")), None);
        assert_eq!(extract_bearer_token(Some("Bearer ")), None);
        assert_eq!(extract_bearer_token(None), None);
    }
}

/// JWT Authentication Middleware
pub struct JwtAuth {
    token_manager: Rc<TokenManager>,
}

impl JwtAuth {
    pub fn new(token_manager: TokenManager) -> Self {
        Self {
            token_manager: Rc::new(token_manager),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for JwtAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = JwtAuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(JwtAuthMiddleware {
            service: Rc::new(service),
            token_manager: self.token_manager.clone(),
        }))
    }
}

pub struct JwtAuthMiddleware<S> {
    service: Rc<S>,
    token_manager: Rc<TokenManager>,
}

impl<S, B> Service<ServiceRequest> for JwtAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let token_manager = self.token_manager.clone();

        Box::pin(async move {
            // Prefer httpOnly session cookie (web clients); fall back to Bearer token (API/mobile).
            let token_str: String = if let Some(cookie) = req.cookie("valueskins_session") {
                cookie.value().to_owned()
            } else {
                let auth_header = req
                    .headers()
                    .get("Authorization")
                    .and_then(|h| h.to_str().ok());
                if let Some(token) = extract_bearer_token(auth_header) {
                    token.to_owned()
                } else {
                    let response = HttpResponse::Unauthorized()
                        .json(serde_json::json!({ "error": "Missing or invalid session" }));
                    return Ok(req.into_response(response).map_into_right_body());
                }
            };
            let token = token_str.as_str();

            // Verify token and store full claims in request extensions
            match token_manager.validate_token(token) {
                Ok(claims) => {
                    // Inject user ID for the logging middleware (decoupled from auth_service)
                    req.extensions_mut().insert(LogUserId(claims.sub.clone()));
                    req.extensions_mut().insert(claims);
                }
                Err(_) => {
                    let response = HttpResponse::Unauthorized()
                        .json(serde_json::json!({ "error": "Invalid or expired token" }));
                    return Ok(req.into_response(response).map_into_right_body());
                }
            }

            // Continue to handler
            let res = service.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}
