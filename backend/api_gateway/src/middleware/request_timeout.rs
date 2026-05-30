//! Request Timeout Middleware
//!
//! Enforces a maximum duration per request. Without this, a single slow
//! query holds a connection pool slot indefinitely, starving other requests.
//!
//! At Meta scale: one 60-second query × 20 pool connections = pool exhaustion in 20 requests.

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
    body::EitherBody,
};
use futures_util::future::LocalBoxFuture;
use std::{future::{ready, Ready}, rc::Rc, time::Duration};

pub struct RequestTimeout {
    timeout: Duration,
}

impl RequestTimeout {
    pub fn new(timeout: Duration) -> Self {
        Self { timeout }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RequestTimeout
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = RequestTimeoutMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequestTimeoutMiddleware {
            service: Rc::new(service),
            timeout: self.timeout,
        }))
    }
}

pub struct RequestTimeoutMiddleware<S> {
    service: Rc<S>,
    timeout: Duration,
}

impl<S, B> Service<ServiceRequest> for RequestTimeoutMiddleware<S>
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
        let timeout = self.timeout;

        Box::pin(async move {
            match tokio::time::timeout(timeout, service.call(req)).await {
                Ok(result) => result.map(|res| res.map_into_left_body()),
                Err(_elapsed) => {
                    tracing::warn!(
                        timeout_ms = timeout.as_millis() as u64,
                        "Request timed out"
                    );
                    Err(actix_web::error::ErrorGatewayTimeout(
                        "Request timed out"
                    ))
                }
            }
        })
    }
}
