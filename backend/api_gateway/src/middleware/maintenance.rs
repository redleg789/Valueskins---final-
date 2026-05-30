//! Maintenance mode middleware.
//!
//! When `platform_config.maintenance_mode_enabled = TRUE`, every request except
//! `/health/*` and `/v1/admin/*` returns HTTP 503 with the admin-configured message.
//! Cache: delegates to `PlatformConfigService` (30s TTL) — zero extra DB queries per request.

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse,
    body::EitherBody,
};
use futures_util::future::LocalBoxFuture;
use std::{future::{ready, Ready}, rc::Rc, sync::Arc};
use shared::platform_config::PlatformConfigService;

pub struct MaintenanceGuard {
    platform_cfg: Arc<PlatformConfigService>,
}

impl MaintenanceGuard {
    pub fn new(platform_cfg: Arc<PlatformConfigService>) -> Self {
        Self { platform_cfg }
    }
}

impl<S, B> Transform<S, ServiceRequest> for MaintenanceGuard
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = MaintenanceMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(MaintenanceMiddleware {
            service: Rc::new(service),
            platform_cfg: self.platform_cfg.clone(),
        }))
    }
}

pub struct MaintenanceMiddleware<S> {
    service: Rc<S>,
    platform_cfg: Arc<PlatformConfigService>,
}

impl<S, B> Service<ServiceRequest> for MaintenanceMiddleware<S>
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
        let platform_cfg = self.platform_cfg.clone();

        Box::pin(async move {
            let path = req.path().to_owned();

            // Health checks and admin panel always bypass maintenance mode
            let is_exempt = path.starts_with("/health")
                || path.starts_with("/v1/admin")
                || path == "/v1/auth/login"    // allow admins to log in
                || path == "/v1/auth/refresh";

            if !is_exempt {
                let (in_maintenance, message) = platform_cfg.is_maintenance().await;
                if in_maintenance {
                    let body = if message.is_empty() {
                        "Platform is temporarily unavailable for maintenance. Please try again soon.".to_string()
                    } else {
                        message
                    };
                    let response = HttpResponse::ServiceUnavailable()
                        .insert_header(("Retry-After", "3600"))
                        .json(serde_json::json!({
                            "error": "maintenance",
                            "message": body,
                        }));
                    return Ok(req.into_response(response).map_into_right_body());
                }
            }

            let res = service.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}
