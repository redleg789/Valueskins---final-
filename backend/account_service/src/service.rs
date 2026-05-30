use sqlx::PgPool;
use crate::models::*;
use crate::errors::AccountError;

pub struct AccountService {
    pool: PgPool,
}

impl AccountService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ── Account CRUD ──

    pub async fn get_account_by_id(&self, account_id: i64) -> Result<AccountRow, AccountError> {
        sqlx::query_as::<_, AccountRow>(
            "SELECT * FROM accounts WHERE id = $1"
        )
        .bind(account_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AccountError::NotFound)
    }

    pub async fn get_account_by_email(&self, email: &str) -> Result<AccountRow, AccountError> {
        sqlx::query_as::<_, AccountRow>(
            "SELECT * FROM accounts WHERE email = $1"
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AccountError::NotFound)
    }

    pub async fn update_account(
        &self,
        account_id: i64,
        req: UpdateAccountRequest,
    ) -> Result<AccountRow, AccountError> {
        sqlx::query_as::<_, AccountRow>(
            r#"UPDATE accounts SET
                display_name = COALESCE($2, display_name),
                avatar_url = COALESCE($3, avatar_url),
                preferred_locale = COALESCE($4, preferred_locale),
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#
        )
        .bind(account_id)
        .bind(req.display_name)
        .bind(req.avatar_url)
        .bind(req.preferred_locale)
        .fetch_one(&self.pool)
        .await
        .map_err(AccountError::from)
    }

    pub async fn get_account_with_modules(&self, account_id: i64) -> Result<AccountResponse, AccountError> {
        let account = self.get_account_by_id(account_id).await?;
        let modules = self.list_modules(account_id).await?;

        let mut resp = AccountResponse::from(account);
        resp.modules = modules.into_iter().map(|m| ModuleSummary {
            code: m.module_code,
            is_active: m.is_active,
            activated_at: Some(m.activated_at),
        }).collect();

        Ok(resp)
    }

    // ── Module Management ──

    pub async fn list_modules(&self, account_id: i64) -> Result<Vec<UserModuleRow>, AccountError> {
        Ok(sqlx::query_as::<_, UserModuleRow>(
            "SELECT * FROM user_modules WHERE account_id = $1 ORDER BY activated_at"
        )
        .bind(account_id)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn activate_module(&self, account_id: i64, module_code: &str) -> Result<UserModuleRow, AccountError> {
        let valid_modules = ["explorer", "host", "valueskin", "brand", "community"];
        if !valid_modules.contains(&module_code) {
            return Err(AccountError::ModuleNotFound);
        }

        let existing = sqlx::query_as::<_, UserModuleRow>(
            "SELECT * FROM user_modules WHERE account_id = $1 AND module_code = $2"
        )
        .bind(account_id)
        .bind(module_code)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(module) = existing {
            if module.is_active {
                return Err(AccountError::ModuleAlreadyActive);
            }
            // Reactivate
            return Ok(sqlx::query_as::<_, UserModuleRow>(
                "UPDATE user_modules SET is_active = TRUE, deactivated_at = NULL, metadata = '{}'::JSONB WHERE id = $1 RETURNING *"
            )
            .bind(module.id)
            .fetch_one(&self.pool)
            .await?);
        }

        // Create new module
        Ok(sqlx::query_as::<_, UserModuleRow>(
            "INSERT INTO user_modules (account_id, module_code, is_active) VALUES ($1, $2, TRUE) RETURNING *"
        )
        .bind(account_id)
        .bind(module_code)
        .fetch_one(&self.pool)
        .await?)
    }

    pub async fn deactivate_module(&self, account_id: i64, module_code: &str) -> Result<UserModuleRow, AccountError> {
        let existing = sqlx::query_as::<_, UserModuleRow>(
            "SELECT * FROM user_modules WHERE account_id = $1 AND module_code = $2 AND is_active = TRUE"
        )
        .bind(account_id)
        .bind(module_code)
        .fetch_optional(&self.pool)
        .await?;

        match existing {
            None => Err(AccountError::ModuleNotActive),
            Some(module) => {
                // Ensure at least one module remains active
                let active_count: (i64,) = sqlx::query_as(
                    "SELECT COUNT(*) FROM user_modules WHERE account_id = $1 AND is_active = TRUE AND id != $2"
                )
                .bind(account_id)
                .bind(module.id)
                .fetch_one(&self.pool)
                .await?;

                if active_count.0 == 0 {
                    return Err(AccountError::CannotDeactivateLastModule);
                }

                Ok(sqlx::query_as::<_, UserModuleRow>(
                    "UPDATE user_modules SET is_active = FALSE, deactivated_at = NOW() WHERE id = $1 RETURNING *"
                )
                .bind(module.id)
                .fetch_one(&self.pool)
                .await?)
            }
        }
    }

    // ── Onboarding ──

    pub async fn update_preferences(
        &self,
        account_id: i64,
        preferences: &[String],
    ) -> Result<AccountRow, AccountError> {
        let valid_prefs = [
            "attend_events", "host_events", "discover_people",
            "build_valueskin", "find_creators", "explore",
        ];

        for pref in preferences {
            if !valid_prefs.contains(&pref.as_str()) {
                return Err(AccountError::InvalidPreferences);
            }
        }

        let prefs_json: serde_json::Value = serde_json::to_value(preferences)
            .map_err(|_| AccountError::InvalidPreferences)?;

        let account = sqlx::query_as::<_, AccountRow>(
            r#"UPDATE accounts SET
                preferences = $2,
                onboarding_stage = 'complete',
                updated_at = NOW()
               WHERE id = $1
               RETURNING *"#
        )
        .bind(account_id)
        .bind(&prefs_json)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(AccountError::NotFound)?;

        // Auto-activate explorer module on first preference save
        self.auto_activate_default_modules(account_id).await?;

        Ok(account)
    }

    async fn auto_activate_default_modules(&self, account_id: i64) -> Result<(), AccountError> {
        // Always ensure explorer is active
        match self.activate_module(account_id, "explorer").await {
            Ok(_) | Err(AccountError::ModuleAlreadyActive) => Ok(()),
            Err(e) => Err(e),
        }
    }

    // ── Permissions ──

    pub async fn get_permissions(&self, account_id: i64) -> Result<Vec<String>, AccountError> {
        let modules = sqlx::query_as::<_, UserModuleRow>(
            "SELECT * FROM user_modules WHERE account_id = $1 AND is_active = TRUE"
        )
        .bind(account_id)
        .fetch_all(&self.pool)
        .await?;

        let mut perms = Vec::new();
        for module in &modules {
            let module_perms = MODULE_PERMISSIONS.iter()
                .find(|(code, _)| *code == module.module_code)
                .map(|(_, perms)| *perms)
                .unwrap_or(&[]);
            perms.extend_from_slice(module_perms);
        }

        Ok(perms.into_iter().map(|s| s.to_string()).collect())
    }

    // ── Sessions ──

    pub async fn list_sessions(&self, account_id: i64) -> Result<Vec<SessionRow>, AccountError> {
        Ok(sqlx::query_as::<_, SessionRow>(
            "SELECT * FROM sessions WHERE account_id = $1 AND is_active = TRUE ORDER BY issued_at DESC"
        )
        .bind(account_id)
        .fetch_all(&self.pool)
        .await?)
    }

    pub async fn revoke_session(&self, session_id: uuid::Uuid, account_id: i64) -> Result<(), AccountError> {
        let result = sqlx::query(
            "UPDATE sessions SET is_active = FALSE, revoked_at = NOW() WHERE id = $1 AND account_id = $2"
        )
        .bind(session_id)
        .bind(account_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AccountError::NotFound);
        }
        Ok(())
    }

    pub async fn get_or_create_account(
        &self,
        email: Option<&str>,
        google_sub: Option<&str>,
        apple_user: Option<&str>,
        display_name: &str,
    ) -> Result<AccountRow, AccountError> {
        // Check by Google sub
        if let Some(sub) = google_sub {
            if let Ok(account) = sqlx::query_as::<_, AccountRow>(
                "SELECT * FROM accounts WHERE google_sub = $1"
            )
            .bind(sub)
            .fetch_optional(&self.pool)
            .await
            {
                if let Some(a) = account {
                    return Ok(a);
                }
            }
        }

        // Check by Apple user
        if let Some(apple) = apple_user {
            if let Ok(Some(account)) = sqlx::query_as::<_, AccountRow>(
                "SELECT * FROM accounts WHERE apple_user = $1"
            )
            .bind(apple)
            .fetch_optional(&self.pool)
            .await
            {
                return Ok(account);
            }
        }

        // Check by email
        if let Some(email) = email {
            if let Ok(Some(account)) = sqlx::query_as::<_, AccountRow>(
                "SELECT * FROM accounts WHERE email = $1"
            )
            .bind(email)
            .fetch_optional(&self.pool)
            .await
            {
                return Ok(account);
            }
        }

        // Create new account
        let account = sqlx::query_as::<_, AccountRow>(
            r#"INSERT INTO accounts (email, google_sub, apple_user, display_name)
               VALUES ($1, $2, $3, $4)
               RETURNING *"#
        )
        .bind(email)
        .bind(google_sub)
        .bind(apple_user)
        .bind(display_name)
        .fetch_one(&self.pool)
        .await?;

        Ok(account)
    }

    pub async fn update_last_login(
        &self,
        account_id: i64,
        ip_address: Option<std::net::IpAddr>,
    ) -> Result<(), AccountError> {
        sqlx::query(
            r#"UPDATE accounts SET
                last_login_at = NOW(),
                last_login_ip = $2,
                login_count = login_count + 1
               WHERE id = $1"#
        )
        .bind(account_id)
        .bind(ip_address.map(|ip| sqlx::types::ipnetwork::IpNetwork::from(ip)))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn check_linked_auth_method(
        &self,
        email: Option<&str>,
        google_sub: Option<&str>,
        apple_user: Option<&str>,
    ) -> Result<Option<AccountRow>, AccountError> {
        if let Some(sub) = google_sub {
            if let Ok(Some(a)) = sqlx::query_as::<_, AccountRow>(
                "SELECT * FROM accounts WHERE google_sub = $1"
            )
            .bind(sub)
            .fetch_optional(&self.pool)
            .await
            {
                return Ok(Some(a));
            }
        }
        if let Some(apple) = apple_user {
            if let Ok(Some(a)) = sqlx::query_as::<_, AccountRow>(
                "SELECT * FROM accounts WHERE apple_user = $1"
            )
            .bind(apple)
            .fetch_optional(&self.pool)
            .await
            {
                return Ok(Some(a));
            }
        }
        if let Some(email) = email {
            if let Ok(Some(a)) = sqlx::query_as::<_, AccountRow>(
                "SELECT * FROM accounts WHERE email = $1"
            )
            .bind(email)
            .fetch_optional(&self.pool)
            .await
            {
                return Ok(Some(a));
            }
        }
        Ok(None)
    }

    pub async fn link_google_sub(&self, account_id: i64, google_sub: &str) -> Result<(), AccountError> {
        sqlx::query("UPDATE accounts SET google_sub = $2 WHERE id = $1")
            .bind(account_id)
            .bind(google_sub)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn link_apple_user(&self, account_id: i64, apple_user: &str) -> Result<(), AccountError> {
        sqlx::query("UPDATE accounts SET apple_user = $2 WHERE id = $1")
            .bind(account_id)
            .bind(apple_user)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
