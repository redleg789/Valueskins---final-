//! Pluggable creator data source system
//! Supports switching between mock (MVP) and real social API data (production)
//!
//! This allows the system to launch with hardcoded mock data for MVP testing,
//! then seamlessly switch to real Instagram/YouTube/TikTok/LinkedIn data when
//! those platforms adopt the ValueSkins marketplace.

use serde::{Deserialize, Serialize};
use async_trait::async_trait;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CreatorProfile {
    pub id: String,
    pub platform: String, // "instagram", "tiktok", "youtube", "linkedin"
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatorQuery {
    pub platform: String,
    pub limit: i32,
    pub offset: i32,
    pub profession: Option<String>,
    pub min_followers: Option<i64>,
    pub verified_only: bool,
}

/// Abstraction layer for creator data sources
/// Implementation can be swapped between mock and real APIs
#[async_trait]
pub trait CreatorDataSource: Send + Sync {
    /// Fetch creators matching the query
    async fn search_creators(&self, query: CreatorQuery) -> Result<Vec<CreatorProfile>, SourceError>;

    /// Get a single creator by ID and platform
    async fn get_creator(&self, platform: &str, creator_id: &str) -> Result<CreatorProfile, SourceError>;

    /// Get creators by profession/value skin
    async fn get_creators_by_profession(&self, platform: &str, profession: &str, limit: i32) -> Result<Vec<CreatorProfile>, SourceError>;

    /// Refresh creator data from source (no-op for mock, API call for real)
    async fn refresh_creator(&self, platform: &str, creator_id: &str) -> Result<(), SourceError>;

    /// Get data source name for logging
    fn source_name(&self) -> &str;

    /// Is this a mock source (MVP) or real API?
    fn is_mock(&self) -> bool;
}

#[derive(Debug)]
pub enum SourceError {
    NotFound,
    APIError(String),
    DatabaseError(String),
    ConfigError(String),
}

impl std::fmt::Display for SourceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SourceError::NotFound => write!(f, "Creator not found"),
            SourceError::APIError(e) => write!(f, "API error: {}", e),
            SourceError::DatabaseError(e) => write!(f, "Database error: {}", e),
            SourceError::ConfigError(e) => write!(f, "Configuration error: {}", e),
        }
    }
}

impl std::error::Error for SourceError {}

/// Mock data source for MVP testing
/// Used until Instagram/YouTube/TikTok/LinkedIn officially adopt ValueSkins
pub struct MockCreatorSource {
    instagram_creators: Vec<CreatorProfile>,
    youtube_channels: Vec<CreatorProfile>,
    tiktok_creators: Vec<CreatorProfile>,
    linkedin_professionals: Vec<CreatorProfile>,
}

impl MockCreatorSource {
    pub fn new() -> Self {
        Self {
            instagram_creators: Self::instagram_mock_data(),
            youtube_channels: Self::youtube_mock_data(),
            tiktok_creators: Self::tiktok_mock_data(),
            linkedin_professionals: Self::linkedin_mock_data(),
        }
    }

    fn instagram_mock_data() -> Vec<CreatorProfile> {
        vec![
            CreatorProfile {
                id: "ig_1".to_string(),
                platform: "instagram".to_string(),
                username: "@alex_codes".to_string(),
                display_name: "Alex Rivera".to_string(),
                followers_count: 890_000,
                engagement_rate: 7.2,
                bio: "Software Engineer | Tech Content Creator".to_string(),
                profile_image_url: "https://via.placeholder.com/150".to_string(),
                verified: true,
                value_skin: "Software Engineer".to_string(),
                profession: "Technology".to_string(),
                estimated_rate_usd: 4_500,
            },
            CreatorProfile {
                id: "ig_2".to_string(),
                platform: "instagram".to_string(),
                username: "@designbydiana".to_string(),
                display_name: "Diana Park".to_string(),
                followers_count: 560_000,
                engagement_rate: 8.4,
                bio: "UX/UI Designer | Design Systems".to_string(),
                profile_image_url: "https://via.placeholder.com/150".to_string(),
                verified: true,
                value_skin: "Product Designer".to_string(),
                profession: "Design".to_string(),
                estimated_rate_usd: 3_200,
            },
        ]
    }

    fn youtube_mock_data() -> Vec<CreatorProfile> {
        vec![
            CreatorProfile {
                id: "yt_1".to_string(),
                platform: "youtube".to_string(),
                username: "@techflowreviews".to_string(),
                display_name: "TechFlow Reviews".to_string(),
                followers_count: 2_300_000,
                engagement_rate: 5.8,
                bio: "Tech product reviews and tutorials".to_string(),
                profile_image_url: "https://via.placeholder.com/150".to_string(),
                verified: true,
                value_skin: "Tech Reviewer".to_string(),
                profession: "Technology".to_string(),
                estimated_rate_usd: 5_500,
            },
        ]
    }

    fn tiktok_mock_data() -> Vec<CreatorProfile> {
        vec![
            CreatorProfile {
                id: "tt_1".to_string(),
                platform: "tiktok".to_string(),
                username: "@content_creator_pro".to_string(),
                display_name: "Content Creator Pro".to_string(),
                followers_count: 1_200_000,
                engagement_rate: 12.3,
                bio: "Entertainment & lifestyle content".to_string(),
                profile_image_url: "https://via.placeholder.com/150".to_string(),
                verified: false,
                value_skin: "Content Creator".to_string(),
                profession: "Entertainment".to_string(),
                estimated_rate_usd: 2_800,
            },
        ]
    }

    fn linkedin_mock_data() -> Vec<CreatorProfile> {
        vec![
            CreatorProfile {
                id: "li_1".to_string(),
                platform: "linkedin".to_string(),
                username: "dr-sarah-chen".to_string(),
                display_name: "Dr. Sarah Chen".to_string(),
                followers_count: 180_000,
                engagement_rate: 4.5,
                bio: "AI Infrastructure Expert | Speaking on enterprise systems".to_string(),
                profile_image_url: "https://via.placeholder.com/150".to_string(),
                verified: true,
                value_skin: "AI Expert".to_string(),
                profession: "Technology".to_string(),
                estimated_rate_usd: 8_000,
            },
        ]
    }
}

#[async_trait]
impl CreatorDataSource for MockCreatorSource {
    async fn search_creators(&self, query: CreatorQuery) -> Result<Vec<CreatorProfile>, SourceError> {
        let creators = match query.platform.as_str() {
            "instagram" => &self.instagram_creators,
            "youtube" => &self.youtube_channels,
            "tiktok" => &self.tiktok_creators,
            "linkedin" => &self.linkedin_professionals,
            _ => return Err(SourceError::APIError("Unknown platform".to_string())),
        };

        let mut results: Vec<CreatorProfile> = creators
            .iter()
            .filter(|c| {
                if let Some(prof) = &query.profession {
                    c.profession.to_lowercase().contains(&prof.to_lowercase())
                } else {
                    true
                }
            })
            .filter(|c| {
                if let Some(min) = query.min_followers {
                    c.followers_count >= min
                } else {
                    true
                }
            })
            .filter(|c| {
                if query.verified_only {
                    c.verified
                } else {
                    true
                }
            })
            .cloned()
            .collect();

        results.sort_by(|a, b| b.followers_count.cmp(&a.followers_count));
        Ok(results.into_iter().skip(query.offset as usize).take(query.limit as usize).collect())
    }

    async fn get_creator(&self, platform: &str, creator_id: &str) -> Result<CreatorProfile, SourceError> {
        let creators = match platform {
            "instagram" => &self.instagram_creators,
            "youtube" => &self.youtube_channels,
            "tiktok" => &self.tiktok_creators,
            "linkedin" => &self.linkedin_professionals,
            _ => return Err(SourceError::APIError("Unknown platform".to_string())),
        };

        creators.iter()
            .find(|c| c.id == creator_id)
            .cloned()
            .ok_or(SourceError::NotFound)
    }

    async fn get_creators_by_profession(&self, platform: &str, profession: &str, limit: i32) -> Result<Vec<CreatorProfile>, SourceError> {
        let query = CreatorQuery {
            platform: platform.to_string(),
            limit,
            offset: 0,
            profession: Some(profession.to_string()),
            min_followers: None,
            verified_only: false,
        };
        self.search_creators(query).await
    }

    async fn refresh_creator(&self, _platform: &str, _creator_id: &str) -> Result<(), SourceError> {
        // No-op for mock data
        Ok(())
    }

    fn source_name(&self) -> &str {
        "MockCreatorSource"
    }

    fn is_mock(&self) -> bool {
        true
    }
}

/// Factory to get the appropriate data source
pub struct CreatorSourceFactory;

impl CreatorSourceFactory {
    pub fn create(use_real_api: bool) -> Arc<dyn CreatorDataSource> {
        if use_real_api {
            panic!("Real creator data source is not implemented; refusing to fall back to mock data");
        } else {
            Arc::new(MockCreatorSource::new())
        }
    }

    /// Factory that reads from environment variable
    /// Set CREATOR_DATA_SOURCE=instagram|mock (default: mock)
    pub fn from_env() -> Arc<dyn CreatorDataSource> {
        let is_production = std::env::var("RUST_ENV").ok().as_deref() == Some("production");
        let source = std::env::var("CREATOR_DATA_SOURCE")
            .unwrap_or_else(|_| {
                if is_production {
                    panic!("CREATOR_DATA_SOURCE must be set in production");
                }
                "mock".to_string()
            })
            .to_lowercase();

        match source.as_str() {
            "instagram" | "api" => Self::create(true),
            "mock" if !is_production => Self::create(false),
            "mock" => panic!("Mock creator data source is not allowed in production"),
            _ => panic!("Unsupported CREATOR_DATA_SOURCE value: {}", source),
        }
    }
}
