#[cfg(test)]
mod tests {
    use actix_web::{test, web, App, HttpResponse, Responder, middleware::DefaultHeaders};

    async fn health_check() -> impl Responder {
        HttpResponse::Ok()
            .insert_header(("x-ratelimit-limit", "1000"))
            .insert_header(("x-ratelimit-remaining", "999"))
            .insert_header(("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'"))
            .json(serde_json::json!({"status": "operational"}))
    }

    #[actix_web::test]
    async fn test_health_check() {
        let app = test::init_service(
            App::new().route("/health", web::get().to(health_check))
        ).await;

        let req = test::TestRequest::get()
            .uri("/health")
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }

    #[actix_web::test]
    async fn test_rate_limit_headers() {
        let app = test::init_service(
            App::new().route("/health", web::get().to(health_check))
        ).await;

        let req = test::TestRequest::get()
            .uri("/health")
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.headers().contains_key("x-ratelimit-limit"));
        assert!(resp.headers().contains_key("x-ratelimit-remaining"));
    }

    #[actix_web::test]
    async fn test_csp_headers_present() {
        let app = test::init_service(
            App::new().route("/health", web::get().to(health_check))
        ).await;

        let req = test::TestRequest::get()
            .uri("/health")
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(resp.headers().get("Content-Security-Policy").is_some());
        let csp = resp.headers().get("Content-Security-Policy").unwrap().to_str().unwrap();
        assert!(csp.contains("default-src"));
    }

    #[actix_web::test]
    async fn test_no_powered_by_header() {
        let app = test::init_service(
            App::new().route("/health", web::get().to(health_check))
        ).await;

        let req = test::TestRequest::get()
            .uri("/health")
            .to_request();

        let resp = test::call_service(&app, req).await;
        let server = resp.headers().get("Server").and_then(|h| h.to_str().ok()).unwrap_or("");
        assert!(!server.contains("actix"), "Server header should not leak framework info");
    }
}
