//! Referral Service Core Logic

use sqlx::PgPool;
use chrono::Utc;
use sha2::{Sha256, Digest};
use crate::models::*;

pub struct ReferralService {
    pool: PgPool,
}

impl ReferralService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Creates a new referral code for a persona
    pub async fn create_code(
        &self,
        persona_id: i64,
        code: &str,
    ) -> Result<CreateCodeResponse, ServiceError> {
        // Validate code format (alphanumeric, 3-20 chars)
        let code = code.to_uppercase();
        if code.len() < 3 || code.len() > 20 {
            return Err(ServiceError::InvalidCode("Code must be 3-20 characters".to_string()));
        }
        if !code.chars().all(|c| c.is_alphanumeric()) {
            return Err(ServiceError::InvalidCode("Code must be alphanumeric".to_string()));
        }
        
        // Hash the code
        let code_hash = hash_code(&code);
        
        // Check if code exists
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT id FROM referral_codes WHERE code_hash = $1"
        )
        .bind(&code_hash)
        .fetch_optional(&self.pool)
        .await?;
        
        if existing.is_some() {
            return Err(ServiceError::CodeExists);
        }
        
        // Check if persona already has a code
        let existing_for_persona = sqlx::query_scalar::<_, i64>(
            "SELECT id FROM referral_codes WHERE persona_id = $1"
        )
        .bind(persona_id)
        .fetch_optional(&self.pool)
        .await?;
        
        if existing_for_persona.is_some() {
            return Err(ServiceError::AlreadyHasCode);
        }
        
        // Create the code
        sqlx::query(
            r#"
            INSERT INTO referral_codes (persona_id, code, code_hash, uses, total_earnings, is_active)
            VALUES ($1, $2, $3, 0, '0', true)
            "#
        )
        .bind(persona_id)
        .bind(&code)
        .bind(&code_hash)
        .execute(&self.pool)
        .await?;
        
        Ok(CreateCodeResponse {
            code: code.clone(),
            referral_link: format!("https://valueskins.io?ref={}", code),
        })
    }

    /// Records a referral when a new persona is created
    pub async fn record_referral(
        &self,
        new_persona_id: i64,
        referral_code: &str,
        mint_amount_wei: Option<&str>,
    ) -> Result<(), ServiceError> {
        let code_hash = hash_code(&referral_code.to_uppercase());
        
        // Get the referral code
        let ref_code = sqlx::query_as::<_, ReferralCode>(
            "SELECT * FROM referral_codes WHERE code_hash = $1 AND is_active = true"
        )
        .bind(&code_hash)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::CodeNotFound)?;
        
        // Get the new persona's owner
        let new_owner: String = sqlx::query_scalar(
            "SELECT owner_address FROM personas WHERE id = $1"
        )
        .bind(new_persona_id)
        .fetch_one(&self.pool)
        .await?;
        
        // Get referrer's owner (for self-referral check)
        let referrer_owner: String = sqlx::query_scalar(
            "SELECT owner_address FROM personas WHERE id = $1"
        )
        .bind(ref_code.persona_id)
        .fetch_one(&self.pool)
        .await?;
        
        // Prevent self-referral
        if new_owner.to_lowercase() == referrer_owner.to_lowercase() {
            return Err(ServiceError::SelfReferral);
        }
        
        // Check if already referred
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT id FROM referral_chains WHERE new_persona_id = $1"
        )
        .bind(new_persona_id)
        .fetch_optional(&self.pool)
        .await?;
        
        if existing.is_some() {
            return Err(ServiceError::AlreadyReferred);
        }
        
        // Build the referral chain
        let referrer_chain = sqlx::query_as::<_, ReferralChain>(
            "SELECT * FROM referral_chains WHERE new_persona_id = $1"
        )
        .bind(ref_code.persona_id)
        .fetch_optional(&self.pool)
        .await?;
        
        let tier2 = referrer_chain.as_ref().and_then(|c| c.tier1_persona_id);
        let tier3 = referrer_chain.as_ref().and_then(|c| c.tier2_persona_id);
        
        // Insert the chain
        sqlx::query(
            r#"
            INSERT INTO referral_chains (new_persona_id, tier1_persona_id, tier2_persona_id, tier3_persona_id, referral_code_id)
            VALUES ($1, $2, $3, $4, $5)
            "#
        )
        .bind(new_persona_id)
        .bind(ref_code.persona_id)
        .bind(tier2)
        .bind(tier3)
        .bind(ref_code.id)
        .execute(&self.pool)
        .await?;
        
        // Update referral code uses
        sqlx::query("UPDATE referral_codes SET uses = uses + 1 WHERE id = $1")
            .bind(ref_code.id)
            .execute(&self.pool)
            .await?;
        
        // Calculate and record rewards if mint amount provided
        if let Some(amount) = mint_amount_wei {
            self.distribute_rewards(
                ref_code.persona_id,
                tier2,
                tier3,
                new_persona_id,
                amount,
                "persona_mint",
            ).await?;
        }
        
        Ok(())
    }

    /// Distributes rewards to the referral chain
    async fn distribute_rewards(
        &self,
        tier1: i64,
        tier2: Option<i64>,
        tier3: Option<i64>,
        source: i64,
        amount_wei: &str,
        tx_type: &str,
    ) -> Result<(), ServiceError> {
        let amount: u128 = amount_wei.parse().unwrap_or(0);
        if amount == 0 {
            return Ok(());
        }

        // Idempotency: check if rewards already distributed for this source
        let already_distributed: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM referral_rewards WHERE source_persona_id = $1 AND transaction_type = $2)"
        )
        .bind(source)
        .bind(tx_type)
        .fetch_one(&self.pool)
        .await?;

        if already_distributed {
            return Ok(());
        }

        // Tier 1: 10%
        let tier1_reward = amount * 1000 / 10000;
        let tier1_addr: String = sqlx::query_scalar(
            "SELECT owner_address FROM personas WHERE id = $1"
        )
        .bind(tier1)
        .fetch_one(&self.pool)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO referral_rewards
            (recipient_persona_id, recipient_address, source_persona_id, tier, amount_wei, transaction_type, is_claimed)
            VALUES ($1, $2, $3, 1, $4, $5, false)
            ON CONFLICT DO NOTHING
            "#
        )
        .bind(tier1)
        .bind(&tier1_addr)
        .bind(source)
        .bind(tier1_reward.to_string())
        .bind(tx_type)
        .execute(&self.pool)
        .await?;
        
        // Tier 2: 3%
        if let Some(t2) = tier2 {
            let tier2_reward = amount * 300 / 10000;
            let tier2_addr: String = sqlx::query_scalar(
                "SELECT owner_address FROM personas WHERE id = $1"
            )
            .bind(t2)
            .fetch_one(&self.pool)
            .await?;
            
            sqlx::query(
                r#"
                INSERT INTO referral_rewards
                (recipient_persona_id, recipient_address, source_persona_id, tier, amount_wei, transaction_type, is_claimed)
                VALUES ($1, $2, $3, 2, $4, $5, false)
                ON CONFLICT DO NOTHING
                "#
            )
            .bind(t2)
            .bind(&tier2_addr)
            .bind(source)
            .bind(tier2_reward.to_string())
            .bind(tx_type)
            .execute(&self.pool)
            .await?;
        }
        
        // Tier 3: 1%
        if let Some(t3) = tier3 {
            let tier3_reward = amount * 100 / 10000;
            let tier3_addr: String = sqlx::query_scalar(
                "SELECT owner_address FROM personas WHERE id = $1"
            )
            .bind(t3)
            .fetch_one(&self.pool)
            .await?;
            
            sqlx::query(
                r#"
                INSERT INTO referral_rewards
                (recipient_persona_id, recipient_address, source_persona_id, tier, amount_wei, transaction_type, is_claimed)
                VALUES ($1, $2, $3, 3, $4, $5, false)
                ON CONFLICT DO NOTHING
                "#
            )
            .bind(t3)
            .bind(&tier3_addr)
            .bind(source)
            .bind(tier3_reward.to_string())
            .bind(tx_type)
            .execute(&self.pool)
            .await?;
        }
        
        Ok(())
    }

    /// Gets referral stats for a persona
    pub async fn get_stats(&self, persona_id: i64) -> Result<ReferralStatsResponse, ServiceError> {
        let code = sqlx::query_as::<_, ReferralCode>(
            "SELECT * FROM referral_codes WHERE persona_id = $1"
        )
        .bind(persona_id)
        .fetch_optional(&self.pool)
        .await?;
        
        let stats = sqlx::query_as::<_, ReferralStats>(
            "SELECT * FROM referral_stats WHERE persona_id = $1"
        )
        .bind(persona_id)
        .fetch_optional(&self.pool)
        .await?;
        
        let pending: String = sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount_wei::numeric), 0)::text FROM referral_rewards WHERE recipient_persona_id = $1 AND is_claimed = false"
        )
        .bind(persona_id)
        .fetch_one(&self.pool)
        .await?;
        
        let code_str = code.as_ref().map(|c| c.code.clone()).unwrap_or_default();
        
        Ok(ReferralStatsResponse {
            code: code_str.clone(),
            referral_link: if code_str.is_empty() { String::new() } else { format!("https://valueskins.io?ref={}", code_str) },
            total_referrals: stats.as_ref().map(|s| s.total_referrals).unwrap_or(0),
            tier1_count: stats.as_ref().map(|s| s.tier1_count).unwrap_or(0),
            tier2_count: stats.as_ref().map(|s| s.tier2_count).unwrap_or(0),
            tier3_count: stats.as_ref().map(|s| s.tier3_count).unwrap_or(0),
            pending_rewards: pending,
            total_earnings: stats.as_ref().map(|s| s.total_earnings_wei.clone()).unwrap_or_else(|| "0".to_string()),
        })
    }

    /// Gets the referral leaderboard
    pub async fn get_leaderboard(&self, limit: i32) -> Result<Vec<LeaderboardEntry>, ServiceError> {
        let entries = sqlx::query_as::<_, (i64, i32, String, String, Option<String>)>(
            r#"
            SELECT rs.persona_id, rs.total_referrals, rs.total_earnings_wei, p.display_name, p.avatar_uri
            FROM referral_stats rs
            JOIN personas p ON rs.persona_id = p.id
            ORDER BY rs.total_referrals DESC
            LIMIT $1
            "#
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        
        Ok(entries.into_iter().enumerate().map(|(i, e)| {
            LeaderboardEntry {
                rank: (i + 1) as i32,
                persona_id: e.0,
                referral_count: e.1,
                total_earnings: e.2,
                display_name: e.3,
                avatar_uri: e.4,
            }
        }).collect())
    }

    /// Validates a referral code
    pub async fn validate_code(&self, code: &str) -> Result<ValidateCodeResponse, ServiceError> {
        let code_hash = hash_code(&code.to_uppercase());
        
        let result = sqlx::query_as::<_, (i64, String)>(
            r#"
            SELECT rc.persona_id, p.display_name
            FROM referral_codes rc
            JOIN personas p ON rc.persona_id = p.id
            WHERE rc.code_hash = $1 AND rc.is_active = true
            "#
        )
        .bind(&code_hash)
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(match result {
            Some((persona_id, name)) => ValidateCodeResponse {
                valid: true,
                persona_id: Some(persona_id),
                persona_name: Some(name),
            },
            None => ValidateCodeResponse {
                valid: false,
                persona_id: None,
                persona_name: None,
            },
        })
    }
}

fn hash_code(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[derive(Debug)]
pub enum ServiceError {
    InvalidCode(String),
    CodeExists,
    CodeNotFound,
    AlreadyHasCode,
    SelfReferral,
    AlreadyReferred,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ServiceError {
    fn from(e: sqlx::Error) -> Self {
        ServiceError::Database(e)
    }
}
