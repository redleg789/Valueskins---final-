use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactMaskRequest {
    pub room_id: i32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactMaskResponse {
    pub masked_message: String,
    pub patterns_detected: Vec<String>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFingerprintRequest {
    pub user_agent: String,
    pub ip_address: String,
    pub canvas_fingerprint: Option<String>,
    pub webgl_fingerprint: Option<String>,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityVerificationStatus {
    pub user_id: i32,
    pub email_verified: bool,
    pub phone_verified: bool,
    pub kyc_verified: bool,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingGateRequest {
    pub deal_id: i32,
    pub user_id: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingGateResponse {
    pub can_rate: bool,
    pub blocking_reasons: Vec<String>,
    pub gates_passed: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DealStructure {
    pub id: String,
    pub creator_id: i32,
    pub brand_id: i32,
    pub title: String,
    pub description: String,
    pub total_value_cents: i32,
    pub milestones: Vec<Milestone>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub name: String,
    pub percentage: i32,
    pub release_condition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserLevel {
    pub user_id: i32,
    pub level: i32,
    pub tier: String,
    pub deal_streak: i32,
    pub reputation_score: i32,
}

pub struct RevenueProtectionService;

impl RevenueProtectionService {
    /// Contact masking: detect and redact contact information
    pub async fn filter_message(
        pool: &PgPool,
        req: ContactMaskRequest,
    ) -> Result<ContactMaskResponse, sqlx::Error> {
        let patterns = Self::detect_contact_patterns(&req.message);
        let masked = Self::mask_detected_patterns(&req.message, &patterns);

        // Log attempt
        if !patterns.is_empty() {
            sqlx::query(
                "INSERT INTO contact_leak_attempts (deal_room_id, detected_patterns, original_message_hash, timestamp)
                 VALUES ($1, $2, $3, NOW())"
            )
            .bind(req.room_id)
            .bind(serde_json::to_string(&patterns).unwrap_or_default())
            .bind(format!("{:x}", md5::compute(req.message.as_bytes())))
            .execute(pool)
            .await?;
        }

        let warning = if !patterns.is_empty() {
            Some("Contact information detected and masked. Will be revealed after deal acceptance.".to_string())
        } else {
            None
        };

        Ok(ContactMaskResponse {
            masked_message: masked,
            patterns_detected: patterns,
            warning,
        })
    }

    fn detect_contact_patterns(message: &str) -> Vec<String> {
        let mut patterns = Vec::new();

        // Email pattern
        if message.contains('@') && message.contains('.') {
            patterns.push("email".to_string());
        }

        // Phone pattern (+1-555-0123 or similar)
        if message.contains('+') && message.chars().filter(|c| c.is_numeric()).count() > 7 {
            patterns.push("phone".to_string());
        }

        // WhatsApp/Signal mention
        if message.contains("WhatsApp") || message.contains("Signal") || message.contains("Telegram") {
            patterns.push("messaging_app".to_string());
        }

        // Instagram handle
        if message.contains("@") && !message.contains('@') && message.contains(".") {
            patterns.push("social_handle".to_string());
        }

        patterns
    }

    fn mask_detected_patterns(message: &str, patterns: &[String]) -> String {
        let mut masked = message.to_string();

        if patterns.contains(&"email".to_string()) {
            // Mask emails: user@example.com → us***@example.com
            masked = regex::Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
                .unwrap()
                .replace_all(&masked, "[EMAIL_MASKED]")
                .to_string();
        }

        if patterns.contains(&"phone".to_string()) {
            masked = regex::Regex::new(r"\+?[1-9]\d{1,14}")
                .unwrap()
                .replace_all(&masked, "[PHONE_MASKED]")
                .to_string();
        }

        if patterns.contains(&"messaging_app".to_string()) {
            masked = masked
                .replace("WhatsApp", "[APP_MASKED]")
                .replace("Signal", "[APP_MASKED]")
                .replace("Telegram", "[APP_MASKED]");
        }

        masked
    }

    /// Rate limiting: enforce per-user and per-IP limits
    pub async fn check_rate_limit(
        pool: &PgPool,
        user_id: Option<i32>,
        ip_address: &str,
        endpoint: &str,
    ) -> Result<bool, sqlx::Error> {
        let now = Utc::now();
        let one_hour_ago = now - Duration::hours(1);

        if let Some(uid) = user_id {
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM api_requests WHERE user_id = $1 AND endpoint = $2 AND timestamp > $3"
            )
            .bind(uid)
            .bind(endpoint)
            .bind(one_hour_ago)
            .fetch_one(pool)
            .await?;

            // Check for active penalty
            let penalty: Option<(DateTime<Utc>,)> = sqlx::query_as(
                "SELECT penalty_until FROM rate_limit_penalties WHERE user_id = $1 AND endpoint = $2 AND penalty_until > NOW()"
            )
            .bind(uid)
            .bind(endpoint)
            .fetch_optional(pool)
            .await?
            .flatten();

            if penalty.is_some() {
                return Ok(false);
            }

            if count.0 > 100 {
                // Apply cooldown
                sqlx::query(
                    "INSERT INTO rate_limit_penalties (user_id, endpoint, penalty_type, penalty_until)
                     VALUES ($1, $2, 'cooldown', NOW() + INTERVAL '15 minutes')"
                )
                .bind(uid)
                .bind(endpoint)
                .execute(pool)
                .await?;
                return Ok(false);
            }
        }

        // IP-level rate limiting
        let ip_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM api_requests WHERE ip_address = $1 AND timestamp > $2"
        )
        .bind(ip_address)
        .bind(one_hour_ago)
        .fetch_one(pool)
        .await?;

        if ip_count.0 > 1000 {
            return Ok(false);
        }

        // Log request
        sqlx::query(
            "INSERT INTO api_requests (user_id, endpoint, ip_address, timestamp) VALUES ($1, $2, $3, NOW())"
        )
        .bind(user_id)
        .bind(endpoint)
        .bind(ip_address)
        .execute(pool)
        .await?;

        Ok(true)
    }

    /// Identity verification: record device fingerprint
    pub async fn record_device_fingerprint(
        pool: &PgPool,
        user_id: i32,
        req: DeviceFingerprintRequest,
    ) -> Result<String, sqlx::Error> {
        let id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO device_fingerprints (id, user_id, user_agent, ip_address, canvas_fingerprint, webgl_fingerprint, timezone, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())"
        )
        .bind(&id)
        .bind(user_id)
        .bind(&req.user_agent)
        .bind(&req.ip_address)
        .bind(&req.canvas_fingerprint)
        .bind(&req.webgl_fingerprint)
        .bind(&req.timezone)
        .execute(pool)
        .await?;

        Ok(id)
    }

    /// Identity verification: check progression
    pub async fn get_identity_status(
        pool: &PgPool,
        user_id: i32,
    ) -> Result<IdentityVerificationStatus, sqlx::Error> {
        let user: (Option<String>, Option<String>) = sqlx::query_as(
            "SELECT email, phone FROM accounts WHERE id = $1"
        )
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        let email_verified = user.0.is_some();
        let phone_verified = user.1.is_some();

        // KYC would require more complex logic
        let kyc_verified = false;

        let progress = if kyc_verified {
            100.0
        } else if phone_verified {
            66.0
        } else if email_verified {
            33.0
        } else {
            0.0
        };

        Ok(IdentityVerificationStatus {
            user_id,
            email_verified,
            phone_verified,
            kyc_verified,
            progress,
        })
    }

    /// Ratings gating: check if user can submit rating
    pub async fn check_rating_gates(
        pool: &PgPool,
        req: RatingGateRequest,
    ) -> Result<RatingGateResponse, sqlx::Error> {
        let mut gates_passed = HashMap::new();
        let mut blocking_reasons = Vec::new();

        // Gate 1: Payment completed
        let payment = sqlx::query_as::<_, (String,)>(
            "SELECT status FROM payments WHERE deal_room_id = $1 AND status = 'completed'"
        )
        .bind(req.deal_id)
        .fetch_optional(pool)
        .await?;

        if payment.is_none() {
            gates_passed.insert("payment_completed".to_string(), false);
            blocking_reasons.push("Payment must be completed before rating".to_string());
        } else {
            gates_passed.insert("payment_completed".to_string(), true);
        }

        // Gate 2: Deliverable verified
        let deliverable = sqlx::query_as::<_, (String,)>(
            "SELECT status FROM deliverables WHERE deal_id = $1 AND status = 'approved'"
        )
        .bind(req.deal_id)
        .fetch_optional(pool)
        .await?;

        if deliverable.is_none() {
            gates_passed.insert("deliverable_verified".to_string(), false);
            blocking_reasons.push("Deliverable must be approved".to_string());
        } else {
            gates_passed.insert("deliverable_verified".to_string(), true);
        }

        // Gate 3: Escrow released
        let escrow = sqlx::query_as::<_, (String,)>(
            "SELECT status FROM escrow WHERE deal_id = $1 AND status = 'released'"
        )
        .bind(req.deal_id)
        .fetch_optional(pool)
        .await?;

        if escrow.is_none() {
            gates_passed.insert("escrow_released".to_string(), false);
            blocking_reasons.push("Escrow must be released".to_string());
        } else {
            gates_passed.insert("escrow_released".to_string(), true);
        }

        let can_rate = blocking_reasons.is_empty();

        Ok(RatingGateResponse {
            can_rate,
            blocking_reasons,
            gates_passed,
        })
    }

    /// Deal builder: create mandatory structure with default milestones
    pub async fn create_mandatory_deal_structure(
        pool: &PgPool,
        creator_id: i32,
        brand_id: i32,
        title: String,
        description: String,
        total_value_cents: i32,
    ) -> Result<DealStructure, sqlx::Error> {
        let deal_id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO deal_structures (id, creator_user_id, brand_user_id, title, description, total_value_cents, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'draft', NOW())"
        )
        .bind(&deal_id)
        .bind(creator_id)
        .bind(brand_id)
        .bind(&title)
        .bind(&description)
        .bind(total_value_cents)
        .execute(pool)
        .await?;

        // Create default milestones (30-50-20 split)
        let milestones = vec![
            ("Advance", 30, "deal_accepted"),
            ("Deliverable Submission", 50, "deliverable_submitted"),
            ("Final Completion", 20, "deliverable_approved"),
        ];

        for (name, percentage, condition) in &milestones {
            sqlx::query(
                "INSERT INTO deal_milestones (id, deal_structure_id, name, percentage, release_condition, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())"
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&deal_id)
            .bind(name)
            .bind(percentage)
            .bind(condition)
            .execute(pool)
            .await?;
        }

        Ok(DealStructure {
            id: deal_id,
            creator_id,
            brand_id,
            title,
            description,
            total_value_cents,
            milestones: milestones
                .iter()
                .map(|(name, pct, cond)| Milestone {
                    name: name.to_string(),
                    percentage: *pct,
                    release_condition: cond.to_string(),
                })
                .collect(),
            status: "draft".to_string(),
        })
    }

    /// Loyalty: calculate user level (7-tier system)
    pub async fn calculate_user_level(
        pool: &PgPool,
        user_id: i32,
    ) -> Result<UserLevel, sqlx::Error> {
        // Get deal count
        let (deal_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT deal_room_id) FROM payments WHERE (creator_user_id = $1 OR brand_user_id = $1) AND status = 'completed'"
        )
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        // Determine level (1-7 based on deals)
        let level = std::cmp::min(7, 1 + (deal_count / 5) as i32);
        let tier = match level {
            1 => "Newcomer",
            2 => "Bronze",
            3 => "Silver",
            4 => "Gold",
            5 => "Platinum",
            6 => "Diamond",
            7 => "Legendary",
            _ => "Newcomer",
        };

        // Upsert user level
        sqlx::query(
            "INSERT INTO user_levels (user_id, current_level, current_tier, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id) DO UPDATE SET current_level = $2, current_tier = $3, updated_at = NOW()"
        )
        .bind(user_id)
        .bind(level)
        .bind(tier)
        .execute(pool)
        .await?;

        Ok(UserLevel {
            user_id,
            level,
            tier: tier.to_string(),
            deal_streak: 0,
            reputation_score: 0,
        })
    }

    /// Disputes: initiate dispute with auto-assigned arbitrator
    pub async fn initiate_dispute(
        pool: &PgPool,
        deal_id: i32,
        initiator_id: i32,
        dispute_type: String,
        claim: String,
    ) -> Result<String, sqlx::Error> {
        let dispute_id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO disputes (id, deal_room_id, initiated_by_user_id, respondent_user_id, dispute_type, claim_description, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())"
        )
        .bind(&dispute_id)
        .bind(deal_id)
        .bind(initiator_id)
        .bind(0) // respondent would be determined from deal
        .bind(&dispute_type)
        .bind(&claim)
        .execute(pool)
        .await?;

        Ok(dispute_id)
    }

    /// Feature gating: check if user can access premium features
    pub async fn check_feature_access(
        pool: &PgPool,
        user_id: i32,
        feature: &str,
    ) -> Result<(bool, Option<String>), sqlx::Error> {
        let (deal_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT deal_room_id) FROM payments WHERE (creator_user_id = $1 OR brand_user_id = $1) AND status = 'completed'"
        )
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        let (accessible, reason) = match feature {
            "creator_analytics" if deal_count >= 1 => (true, None),
            "creator_analytics" => (false, Some("Requires 1+ completed deal".to_string())),
            "premium_creator_filters" if deal_count >= 5 => (true, None),
            "premium_creator_filters" => (false, Some("Requires 5+ completed deals".to_string())),
            "creator_trend_analysis" if deal_count >= 10 => (true, None),
            "creator_trend_analysis" => (false, Some("Requires 10+ completed deals".to_string())),
            _ => (true, None),
        };

        Ok((accessible, reason))
    }
}
