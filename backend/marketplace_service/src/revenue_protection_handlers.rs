use actix_web::{web, HttpRequest, HttpResponse};
use sqlx::PgPool;
use crate::revenue_protection::{
    RevenueProtectionService, ContactMaskRequest, DeviceFingerprintRequest, RatingGateRequest,
};

pub async fn filter_message(
    pool: web::Data<PgPool>,
    req: web::Json<ContactMaskRequest>,
) -> HttpResponse {
    match RevenueProtectionService::filter_message(pool.get_ref(), req.into_inner()).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => {
            eprintln!("Error filtering message: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to filter message"
            }))
        }
    }
}

pub async fn record_device_fingerprint(
    pool: web::Data<PgPool>,
    http_req: HttpRequest,
    req: web::Json<DeviceFingerprintRequest>,
) -> HttpResponse {
    let user_id: i32 = match http_req.headers().get("x-user-id") {
        Some(h) => match h.to_str().unwrap_or("0").parse() {
            Ok(id) => id,
            Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid user"})),
        },
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing user ID"})),
    };

    match RevenueProtectionService::record_device_fingerprint(pool.get_ref(), user_id, req.into_inner()).await {
        Ok(id) => HttpResponse::Ok().json(serde_json::json!({"id": id})),
        Err(e) => {
            eprintln!("Error recording device fingerprint: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to record fingerprint"}))
        }
    }
}

pub async fn get_identity_status(
    pool: web::Data<PgPool>,
    http_req: HttpRequest,
) -> HttpResponse {
    let user_id: i32 = match http_req.headers().get("x-user-id") {
        Some(h) => match h.to_str().unwrap_or("0").parse() {
            Ok(id) => id,
            Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid user"})),
        },
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing user ID"})),
    };

    match RevenueProtectionService::get_identity_status(pool.get_ref(), user_id).await {
        Ok(status) => HttpResponse::Ok().json(status),
        Err(e) => {
            eprintln!("Error getting identity status: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to get status"}))
        }
    }
}

pub async fn check_rate_limit(
    pool: web::Data<PgPool>,
    http_req: HttpRequest,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let user_id: Option<i32> = http_req
        .headers()
        .get("x-user-id")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse().ok());

    let ip_address = http_req
        .connection_info()
        .peer_addr()
        .unwrap_or("0.0.0.0")
        .to_string();

    let endpoint = body
        .get("endpoint")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    match RevenueProtectionService::check_rate_limit(pool.get_ref(), user_id, &ip_address, endpoint).await {
        Ok(allowed) => {
            if allowed {
                HttpResponse::Ok().json(serde_json::json!({"allowed": true}))
            } else {
                HttpResponse::TooManyRequests().json(serde_json::json!({"allowed": false, "error": "Rate limit exceeded"}))
            }
        }
        Err(e) => {
            eprintln!("Error checking rate limit: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to check rate limit"}))
        }
    }
}

pub async fn check_rating_gates(
    pool: web::Data<PgPool>,
    req: web::Json<RatingGateRequest>,
) -> HttpResponse {
    match RevenueProtectionService::check_rating_gates(pool.get_ref(), req.into_inner()).await {
        Ok(gates) => HttpResponse::Ok().json(gates),
        Err(e) => {
            eprintln!("Error checking rating gates: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to check rating gates"}))
        }
    }
}

pub async fn create_deal_structure(
    pool: web::Data<PgPool>,
    req: web::Json<serde_json::Value>,
) -> HttpResponse {
    let creator_id = match req.get("creator_id").and_then(|v| v.as_i64()) {
        Some(id) => id as i32,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing creator_id"})),
    };

    let brand_id = match req.get("brand_id").and_then(|v| v.as_i64()) {
        Some(id) => id as i32,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing brand_id"})),
    };

    let title = match req.get("title").and_then(|v| v.as_str()) {
        Some(t) => t.to_string(),
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing title"})),
    };

    let description = req.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let total_value_cents = match req.get("total_value_cents").and_then(|v| v.as_i64()) {
        Some(v) => v as i32,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing total_value_cents"})),
    };

    match RevenueProtectionService::create_mandatory_deal_structure(
        pool.get_ref(),
        creator_id,
        brand_id,
        title,
        description,
        total_value_cents,
    )
    .await
    {
        Ok(deal) => HttpResponse::Created().json(deal),
        Err(e) => {
            eprintln!("Error creating deal structure: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to create deal"}))
        }
    }
}

pub async fn calculate_user_level(
    pool: web::Data<PgPool>,
    http_req: HttpRequest,
) -> HttpResponse {
    let user_id: i32 = match http_req.headers().get("x-user-id") {
        Some(h) => match h.to_str().unwrap_or("0").parse() {
            Ok(id) => id,
            Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid user"})),
        },
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing user ID"})),
    };

    match RevenueProtectionService::calculate_user_level(pool.get_ref(), user_id).await {
        Ok(level) => HttpResponse::Ok().json(level),
        Err(e) => {
            eprintln!("Error calculating user level: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to calculate level"}))
        }
    }
}

pub async fn initiate_dispute(
    pool: web::Data<PgPool>,
    http_req: HttpRequest,
    req: web::Json<serde_json::Value>,
) -> HttpResponse {
    let initiator_id: i32 = match http_req.headers().get("x-user-id") {
        Some(h) => match h.to_str().unwrap_or("0").parse() {
            Ok(id) => id,
            Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid user"})),
        },
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing user ID"})),
    };

    let deal_id = match req.get("deal_id").and_then(|v| v.as_i64()) {
        Some(id) => id as i32,
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing deal_id"})),
    };

    let dispute_type = match req.get("dispute_type").and_then(|v| v.as_str()) {
        Some(t) => t.to_string(),
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing dispute_type"})),
    };

    let claim = match req.get("claim").and_then(|v| v.as_str()) {
        Some(c) => c.to_string(),
        None => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Missing claim"})),
    };

    match RevenueProtectionService::initiate_dispute(pool.get_ref(), deal_id, initiator_id, dispute_type, claim).await {
        Ok(id) => HttpResponse::Created().json(serde_json::json!({"id": id})),
        Err(e) => {
            eprintln!("Error initiating dispute: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to initiate dispute"}))
        }
    }
}

pub async fn check_feature_access(
    pool: web::Data<PgPool>,
    http_req: HttpRequest,
    feature: web::Path<String>,
) -> HttpResponse {
    let user_id: i32 = match http_req.headers().get("x-user-id") {
        Some(h) => match h.to_str().unwrap_or("0").parse() {
            Ok(id) => id,
            Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid user"})),
        },
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing user ID"})),
    };

    match RevenueProtectionService::check_feature_access(pool.get_ref(), user_id, &feature).await {
        Ok((accessible, reason)) => {
            if accessible {
                HttpResponse::Ok().json(serde_json::json!({"accessible": true}))
            } else {
                HttpResponse::Forbidden().json(serde_json::json!({
                    "accessible": false,
                    "reason": reason
                }))
            }
        }
        Err(e) => {
            eprintln!("Error checking feature access: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to check feature access"}))
        }
    }
}
