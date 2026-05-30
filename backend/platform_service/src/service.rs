use crate::models::*;
use chrono::Utc;
use sqlx::PgPool;

pub struct PlatformService {
    pool: PgPool,
}

impl PlatformService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ── C-Suite Settings ───────────────────────────────────────────────

    pub async fn get_csuite_settings(
        &self,
        platform_id: &str,
    ) -> Result<PlatformCSuiteSettings, ServiceError> {
        sqlx::query_as::<_, PlatformCSuiteSettings>(
            "SELECT platform_id, enabled, enforcement_type, level_boost_amount, price_multiplier, title_whitelist, verification_strategy, updated_at, updated_by_user_id
             FROM platform_csuite_settings
             WHERE platform_id = $1"
        )
        .bind(platform_id)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    pub async fn update_csuite_settings(
        &self,
        platform_id: &str,
        req: UpdateCSuiteSettingsRequest,
        admin_user_id: i64,
    ) -> Result<PlatformCSuiteSettings, ServiceError> {
        // Validate enforcement_type if provided
        if let Some(ref et) = req.enforcement_type {
            if !["level_boost", "price_multiplier", "both", "none"].contains(&et.as_str()) {
                return Err(ServiceError::BadRequest("Invalid enforcement_type".to_string()));
            }
        }

        // Validate level_boost_amount if provided
        if let Some(lba) = req.level_boost_amount {
            if lba < 0 || lba > 4 {
                return Err(ServiceError::BadRequest("level_boost_amount must be 0-4".to_string()));
            }
        }

        // Validate price_multiplier if provided
        if let Some(pm) = req.price_multiplier {
            if pm < 1.0 || pm > 3.0 {
                return Err(ServiceError::BadRequest("price_multiplier must be 1.0-3.0".to_string()));
            }
        }

        // Validate verification_strategy if provided
        if let Some(ref vs) = req.verification_strategy {
            if !["self_reported", "linkedin_oauth", "admin_verified", "hybrid"].contains(&vs.as_str())
            {
                return Err(ServiceError::BadRequest("Invalid verification_strategy".to_string()));
            }
        }

        // Update with only non-null fields
        let result = sqlx::query_as::<_, PlatformCSuiteSettings>(
            "UPDATE platform_csuite_settings
             SET enabled = COALESCE($2, enabled),
                 enforcement_type = COALESCE($3, enforcement_type),
                 level_boost_amount = COALESCE($4, level_boost_amount),
                 price_multiplier = COALESCE($5, price_multiplier),
                 title_whitelist = COALESCE($6, title_whitelist),
                 verification_strategy = COALESCE($7, verification_strategy),
                 updated_at = NOW(),
                 updated_by_user_id = $8
             WHERE platform_id = $1
             RETURNING platform_id, enabled, enforcement_type, level_boost_amount, price_multiplier, title_whitelist, verification_strategy, updated_at, updated_by_user_id"
        )
        .bind(platform_id)
        .bind(req.enabled)
        .bind(&req.enforcement_type)
        .bind(req.level_boost_amount)
        .bind(req.price_multiplier)
        .bind(&req.title_whitelist)
        .bind(&req.verification_strategy)
        .bind(admin_user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(result)
    }

    // ── Persona Titles ─────────────────────────────────────────────────

    pub async fn add_title(
        &self,
        persona_id: i64,
        req: AddTitleRequest,
        user_id: i64,
    ) -> Result<PersonaTitle, ServiceError> {
        // Check that persona exists and is owned by user
        let _persona = sqlx::query("SELECT owner_user_id FROM personas WHERE id = $1")
            .bind(persona_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| ServiceError::Database(e.to_string()))?;

        if _persona.is_none() {
            return Err(ServiceError::NotFound);
        }

        let verified_at = if req.verified_via == "self_reported" {
            None
        } else {
            Some(Utc::now())
        };

        let title = sqlx::query_as::<_, PersonaTitle>(
            "INSERT INTO persona_titles (persona_id, title, company, verified_via, verified_at, is_verified, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
             ON CONFLICT (persona_id, title, company) DO UPDATE SET is_active = TRUE
             RETURNING id, persona_id, title, company, verified_via, verified_at, is_verified, expires_at, is_active, created_at"
        )
        .bind(persona_id)
        .bind(&req.title)
        .bind(&req.company)
        .bind(&req.verified_via)
        .bind(verified_at)
        .bind(req.verified_via != "self_reported")
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        // Log to audit table
        let _ = sqlx::query(
            "INSERT INTO persona_title_audit (persona_id, user_id, old_title, new_title, changed_by, reason, changed_at)
             VALUES ($1, $2, NULL, $3, 'user_action', 'Title added', NOW())"
        )
        .bind(persona_id)
        .bind(user_id)
        .bind(&req.title)
        .execute(&self.pool)
        .await;

        Ok(title)
    }

    pub async fn list_titles(&self, persona_id: i64) -> Result<Vec<PersonaTitle>, ServiceError> {
        sqlx::query_as::<_, PersonaTitle>(
            "SELECT id, persona_id, title, company, verified_via, verified_at, is_verified, expires_at, is_active, created_at
             FROM persona_titles
             WHERE persona_id = $1 AND is_active = TRUE
             ORDER BY created_at DESC"
        )
        .bind(persona_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    pub async fn verify_title(
        &self,
        title_id: i64,
        admin_user_id: i64,
    ) -> Result<PersonaTitle, ServiceError> {
        sqlx::query_as::<_, PersonaTitle>(
            "UPDATE persona_titles
             SET is_verified = TRUE, verified_at = NOW()
             WHERE id = $1
             RETURNING id, persona_id, title, company, verified_via, verified_at, is_verified, expires_at, is_active, created_at"
        )
        .bind(title_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|_| ServiceError::NotFound)?;

        // Log audit
        let _ = sqlx::query(
            "INSERT INTO persona_title_audit (persona_id, user_id, new_title, changed_by, reason, changed_at)
             SELECT persona_id, $2, title, 'admin_override', 'Title verified', NOW()
             FROM persona_titles WHERE id = $1"
        )
        .bind(title_id)
        .bind(admin_user_id)
        .execute(&self.pool)
        .await;

        self.get_title(title_id).await
    }

    pub async fn get_title(&self, title_id: i64) -> Result<PersonaTitle, ServiceError> {
        sqlx::query_as::<_, PersonaTitle>(
            "SELECT id, persona_id, title, company, verified_via, verified_at, is_verified, expires_at, is_active, created_at
             FROM persona_titles WHERE id = $1"
        )
        .bind(title_id)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    pub async fn remove_title(&self, title_id: i64, user_id: i64) -> Result<(), ServiceError> {
        let rows_affected = sqlx::query("UPDATE persona_titles SET is_active = FALSE WHERE id = $1")
            .bind(title_id)
            .execute(&self.pool)
            .await
            .map_err(ServiceError::from)?
            .rows_affected();

        if rows_affected == 0 {
            return Err(ServiceError::NotFound);
        }

        // Log audit
        let _ = sqlx::query(
            "INSERT INTO persona_title_audit (persona_id, user_id, new_title, changed_by, reason, changed_at)
             SELECT persona_id, $2, title, 'user_action', 'Title removed', NOW()
             FROM persona_titles WHERE id = $1"
        )
        .bind(title_id)
        .bind(user_id)
        .execute(&self.pool)
        .await;

        Ok(())
    }

    // ── Audit Log ──────────────────────────────────────────────────────

    pub async fn get_title_audit_log(
        &self,
        persona_id: i64,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<PersonaTitleAudit>, ServiceError> {
        sqlx::query_as::<_, PersonaTitleAudit>(
            "SELECT id, persona_id, user_id, old_title, new_title, changed_by, reason, changed_at
             FROM persona_title_audit
             WHERE persona_id = $1
             ORDER BY changed_at DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(persona_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    // ── Helper: Get Effective Level (used by matching service) ─────────

    pub async fn get_effective_level(
        &self,
        persona_id: i64,
        base_level: i32,
        platform_id: &str,
    ) -> Result<i32, ServiceError> {
        let settings = self.get_csuite_settings(platform_id).await?;

        if !settings.enabled {
            return Ok(base_level);
        }

        // Check if persona has a whitelisted C-Suite title
        let has_title = sqlx::query(
            "SELECT 1 FROM persona_titles
             WHERE persona_id = $1 AND is_active = TRUE AND is_verified = TRUE
             AND title = ANY($2)"
        )
        .bind(persona_id)
        .bind(&settings.title_whitelist)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ServiceError::Database(e.to_string()))?
        .is_some();

        if has_title {
            // Apply level boost
            Ok((base_level + settings.level_boost_amount).min(5))
        } else {
            Ok(base_level)
        }
    }
}
