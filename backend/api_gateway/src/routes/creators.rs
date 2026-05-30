use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use social_service::creator_source::{CreatorQuery, CreatorSourceFactory};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchCreatorsRequest {
    pub platform: String,
    pub profession: Option<String>,
    pub min_followers: Option<i64>,
    pub verified_only: Option<bool>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatorListResponse {
    pub creators: Vec<CreatorResponse>,
    pub total: usize,
    pub data_source: String,
    pub is_mock: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreatorResponse {
    pub id: String,
    pub platform: String,
    pub username: String,
    pub display_name: String,
    pub followers_count: i64,
    pub engagement_rate: f32,
    pub bio: String,
    pub profile_image_url: String,
    pub verified: bool,
    pub value_skin: String,
    pub profession: String,
    pub estimated_rate_usd: i32,
}

/// GET /api/v1/creators/search
/// Search creators across platforms
pub async fn search_creators(
    req: web::Query<SearchCreatorsRequest>,
) -> impl Responder {
    let source = CreatorSourceFactory::from_env();
    let limit = req.limit.unwrap_or(20);

    let query = CreatorQuery {
        platform: req.platform.clone(),
        limit,
        offset: req.offset.unwrap_or(0),
        profession: req.profession.clone(),
        min_followers: req.min_followers,
        verified_only: req.verified_only.unwrap_or(false),
    };

    match source.search_creators(query).await {
        Ok(creators) => {
            let responses: Vec<CreatorResponse> = creators
                .into_iter()
                .map(|c| CreatorResponse {
                    id: c.id,
                    platform: c.platform,
                    username: c.username,
                    display_name: c.display_name,
                    followers_count: c.followers_count,
                    engagement_rate: c.engagement_rate,
                    bio: c.bio,
                    profile_image_url: c.profile_image_url,
                    verified: c.verified,
                    value_skin: c.value_skin,
                    profession: c.profession,
                    estimated_rate_usd: c.estimated_rate_usd,
                })
                .collect();

            let total = responses.len();
            HttpResponse::Ok().json(CreatorListResponse {
                creators: responses,
                total,
                data_source: source.source_name().to_string(),
                is_mock: source.is_mock(),
            })
        }
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

/// GET /api/v1/creators/{platform}/{creator_id}
/// Get creator profile by ID
pub async fn get_creator(
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (platform, creator_id) = path.into_inner();
    let source = CreatorSourceFactory::from_env();

    match source.get_creator(&platform, &creator_id).await {
        Ok(creator) => {
            let response = CreatorResponse {
                id: creator.id,
                platform: creator.platform,
                username: creator.username,
                display_name: creator.display_name,
                followers_count: creator.followers_count,
                engagement_rate: creator.engagement_rate,
                bio: creator.bio,
                profile_image_url: creator.profile_image_url,
                verified: creator.verified,
                value_skin: creator.value_skin,
                profession: creator.profession,
                estimated_rate_usd: creator.estimated_rate_usd,
            };
            HttpResponse::Ok().json(response)
        }
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

/// GET /api/v1/creators/{platform}/profession/{profession}
/// Get creators by profession
pub async fn get_creators_by_profession(
    path: web::Path<(String, String)>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let (platform, profession) = path.into_inner();
    let limit = query
        .get("limit")
        .and_then(|l| l.parse::<i32>().ok())
        .unwrap_or(20);

    let source = CreatorSourceFactory::from_env();

    match source.get_creators_by_profession(&platform, &profession, limit).await {
        Ok(creators) => {
            let responses: Vec<CreatorResponse> = creators
                .into_iter()
                .map(|c| CreatorResponse {
                    id: c.id,
                    platform: c.platform,
                    username: c.username,
                    display_name: c.display_name,
                    followers_count: c.followers_count,
                    engagement_rate: c.engagement_rate,
                    bio: c.bio,
                    profile_image_url: c.profile_image_url,
                    verified: c.verified,
                    value_skin: c.value_skin,
                    profession: c.profession,
                    estimated_rate_usd: c.estimated_rate_usd,
                })
                .collect();

            let response_count = responses.len();
            HttpResponse::Ok().json(CreatorListResponse {
                creators: responses,
                total: response_count,
                data_source: source.source_name().to_string(),
                is_mock: source.is_mock(),
            })
        }
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/search", web::get().to(search_creators))
        .route("/{platform}/{creator_id}", web::get().to(get_creator))
        .route("/{platform}/profession/{profession}", web::get().to(get_creators_by_profession));
}
