//! Brand API Service
//! 
//! Core service for brand integrations - enables third-party dependency

use sqlx::PgPool;
use chrono::Utc;
use crate::models::*;
use crate::auth::generate_verification_hash;

pub struct BrandApiService {
    pool: PgPool,
}

impl BrandApiService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    
    /// Verifies a creator's level for a specific profession
    /// This is the PRIMARY value proposition for brands
    pub async fn verify_creator(
        &self,
        persona_id: i64,
        profession_id: i64,
    ) -> Result<CreatorVerification, ServiceError> {
        // Get persona info
        let persona = sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            SELECT display_name, avatar_uri
            FROM personas
            WHERE id = $1 AND exists = true
            "#
        )
        .bind(persona_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound("Persona not found".to_string()))?;
        
        // Get profession and level info
        let profession_data = sqlx::query_as::<_, (String, i32, i32, i32, i32, i32)>(
            r#"
            SELECT 
                p.name,
                pp.level,
                COALESCE(pp.activity_score, 0),
                COALESCE(pp.engagement_score, 0),
                COALESCE(pp.consistency_score, 0),
                COALESCE(pp.verification_score, 0)
            FROM persona_professions pp
            JOIN professions p ON pp.profession_id = p.id
            WHERE pp.persona_id = $1 AND pp.profession_id = $2
            "#
        )
        .bind(persona_id)
        .bind(profession_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound("Creator does not have this profession".to_string()))?;
        
        // Get badges
        let badges = sqlx::query_as::<_, (String, String, chrono::DateTime<Utc>)>(
            r#"
            SELECT name, description, earned_at
            FROM persona_badges
            WHERE persona_id = $1
            ORDER BY earned_at DESC
            LIMIT 10
            "#
        )
        .bind(persona_id)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|(name, description, earned_at)| Badge { name, description, earned_at })
        .collect();
        
        let now = Utc::now();
        let verification_hash = generate_verification_hash(
            persona_id,
            profession_id,
            profession_data.1,
            now.timestamp(),
        );
        
        Ok(CreatorVerification {
            persona_id,
            display_name: persona.0,
            profession: profession_data.0,
            level: profession_data.1,
            level_name: level_to_name(profession_data.1).to_string(),
            verified_at: now,
            score_components: ScoreBreakdown {
                activity_score: profession_data.2,
                engagement_score: profession_data.3,
                consistency_score: profession_data.4,
                verification_score: profession_data.5,
                total_score: profession_data.2 + profession_data.3 + profession_data.4 + profession_data.5,
            },
            badges,
            verification_hash,
        })
    }
    
    /// Searches for creators matching criteria
    pub async fn search_creators(
        &self,
        request: CreatorSearchRequest,
    ) -> Result<Vec<CreatorSearchResult>, ServiceError> {
        let limit = request.limit.unwrap_or(20).min(100) as i64;
        let offset = request.offset.unwrap_or(0).max(0) as i64;

        let results = sqlx::query_as::<_, (i64, String, Option<String>, String, i32, f64, bool, chrono::DateTime<Utc>)>(
            r#"
            SELECT
                pe.id as persona_id,
                pe.display_name,
                pe.avatar_uri,
                pr.name as profession,
                pp.level,
                COALESCE(pp.engagement_score::float / 10000, 0) as engagement_rate,
                COALESCE(u.willing_to_barter, FALSE) as willing_to_barter,
                pe.last_active_at
            FROM personas pe
            JOIN persona_professions pp ON pe.id = pp.persona_id
            JOIN professions pr ON pp.profession_id = pr.id
            JOIN users u ON pe.user_id = u.id
            WHERE pe.exists = true
              AND ($1::bigint IS NULL OR pp.profession_id = $1)
              AND ($2::int IS NULL OR pp.level >= $2)
              AND ($3::int IS NULL OR pp.level <= $3)
              AND ($4::text IS NULL OR pr.category = $4)
              AND ($5::bool IS NULL OR $5 = FALSE OR u.willing_to_barter = TRUE)
            ORDER BY pp.level DESC, pe.last_active_at DESC
            LIMIT $6 OFFSET $7
            "#
        )
        .bind(request.profession_id)
        .bind(request.min_level)
        .bind(request.max_level)
        .bind(&request.category)
        .bind(request.open_to_barter)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(results.into_iter().map(|r| CreatorSearchResult {
            persona_id: r.0,
            display_name: r.1,
            avatar_uri: r.2,
            profession: r.3,
            level: r.4,
            level_name: level_to_name(r.4).to_string(),
            engagement_rate: r.5,
            willing_to_barter: r.6,
            last_active: r.7,
        }).collect())
    }
    
    /// Generates embeddable verification badge
    pub async fn generate_embeddable_badge(
        &self,
        persona_id: i64,
        profession_id: i64,
    ) -> Result<EmbeddableBadge, ServiceError> {
        // Get level for styling
        let level: i32 = sqlx::query_scalar(
            "SELECT level FROM persona_professions WHERE persona_id = $1 AND profession_id = $2"
        )
        .bind(persona_id)
        .bind(profession_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound("Profession not found".to_string()))?;
        
        let base_url = "https://valueskins.io";
        let verification_url = format!("{}/verify/{}/{}", base_url, persona_id, profession_id);
        let svg_url = format!("{}/api/badge/{}/{}.svg", base_url, persona_id, profession_id);
        let png_url = format!("{}/api/badge/{}/{}.png", base_url, persona_id, profession_id);
        
        let embed_code = format!(
            r#"<a href="{}" target="_blank"><img src="{}" alt="Valueskins Verified - Level {}" /></a>"#,
            verification_url, svg_url, level
        );
        
        Ok(EmbeddableBadge {
            persona_id,
            profession_id,
            level,
            embed_code,
            svg_url,
            png_url,
            verification_url,
        })
    }
    
    /// Batch verify multiple creators
    pub async fn batch_verify(
        &self,
        requests: Vec<(i64, i64)>, // (persona_id, profession_id)
    ) -> Result<Vec<CreatorVerification>, ServiceError> {
        let mut results = Vec::new();
        
        for (persona_id, profession_id) in requests {
            match self.verify_creator(persona_id, profession_id).await {
                Ok(verification) => results.push(verification),
                Err(_) => continue, // Skip invalid requests
            }
        }
        
        Ok(results)
    }
    
    /// Gets API usage stats for a brand
    pub async fn get_usage_stats(&self, brand_id: i64) -> Result<ApiUsageStats, ServiceError> {
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM api_request_logs WHERE brand_id = $1"
        )
        .bind(brand_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);
        
        let today: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM api_request_logs WHERE brand_id = $1 AND created_at > NOW() - INTERVAL '1 day'"
        )
        .bind(brand_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);
        
        let this_month: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM api_request_logs WHERE brand_id = $1 AND created_at > NOW() - INTERVAL '30 days'"
        )
        .bind(brand_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or(0);
        
        Ok(ApiUsageStats {
            total_requests: total,
            requests_today: today,
            requests_this_month: this_month,
            top_endpoints: vec![], // Would be populated from logs
        })
    }
}

#[derive(Debug)]
pub enum ServiceError {
    NotFound(String),
    Database(sqlx::Error),
    Unauthorized,
}

impl From<sqlx::Error> for ServiceError {
    fn from(e: sqlx::Error) -> Self {
        ServiceError::Database(e)
    }
}
