//! Age Transfer Service
//!
//! Handles the transition from minor to adult account when the minor turns 18.
//! 30-day transfer window: both minor and guardian must confirm.
//! Guardian permissions are revoked on completion.

use crate::models::*;
use chrono::Utc;
use sqlx::PgPool;

pub struct TransferService {
    pool: PgPool,
}

impl TransferService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Check if any minors are turning 18 (called by daily cron)
    pub async fn check_age_up_transfers(&self) -> Result<Vec<AgeTransferRequest>, GuardianError> {
        // Find minors who turn 18 today (based on verified DOB)
        let minors: Vec<(i64, i64)> = sqlx::query_as(
            "SELECT uvp.user_id, gr.id as relationship_id
             FROM user_verification_profiles uvp
             JOIN guardian_relationships gr ON uvp.user_id = gr.minor_user_id
             WHERE uvp.age_verification_state = 'MINOR_ACTIVE'
               AND gr.relationship_state = 'ACTIVE'
               AND uvp.date_of_birth IS NOT NULL
               AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, uvp.date_of_birth)) >= 18
               AND NOT EXISTS (
                   SELECT 1 FROM age_transfer_requests 
                   WHERE user_id = uvp.user_id AND transfer_state = 'COMPLETED'
               )",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(GuardianError::from)?;

        let mut requests = Vec::new();
        for (user_id, relationship_id) in minors {
            let request = sqlx::query_as::<_, AgeTransferRequest>(
                "INSERT INTO age_transfer_requests (user_id, guardian_relationship_id, transfer_state)
                 VALUES ($1, $2, 'PENDING')
                 RETURNING *",
            )
            .bind(user_id)
            .bind(relationship_id)
            .fetch_one(&self.pool)
            .await
            .map_err(GuardianError::from)?;

            // Update user state
            sqlx::query(
                "UPDATE user_verification_profiles 
                 SET age_verification_state = 'AGE_TRANSFERRING_TO_ADULT', updated_at = NOW()
                 WHERE user_id = $1",
            )
            .bind(user_id)
            .execute(&self.pool)
            .await?;

            // Publish event
            let payload = serde_json::json!({
                "user_id": user_id,
                "relationship_id": relationship_id,
                "transfer_id": request.id
            });
            let bus = shared::event_bus::EventBus::new(self.pool.clone());
            let _ = bus.publish(
                "user",
                user_id,
                "guardian.transfer.initiated",
                &payload,
            )
            .await;

            requests.push(request);
        }

        Ok(requests)
    }

    /// Minor confirms transfer
    pub async fn minor_confirms_transfer(
        &self,
        transfer_id: i64,
        user_id: i64,
    ) -> Result<AgeTransferRequest, GuardianError> {
        let request = sqlx::query_as::<_, AgeTransferRequest>(
            "SELECT * FROM age_transfer_requests WHERE id = $1 AND user_id = $2",
        )
        .bind(transfer_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::TransferNotAvailable)?;

        if request.transfer_state != "PENDING" {
            return Err(GuardianError::TransferNotAvailable);
        }

        sqlx::query(
            "UPDATE age_transfer_requests 
             SET transfer_state = 'GUARDIAN_NOTIFIED', user_confirmed_at = NOW(), updated_at = NOW()
             WHERE id = $1",
        )
        .bind(transfer_id)
        .execute(&self.pool)
        .await?;

        // Notify guardian
        let payload = serde_json::json!({
            "transfer_id": transfer_id,
            "user_id": user_id,
            "guardian_relationship_id": request.guardian_relationship_id
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "user",
            user_id,
            "guardian.transfer.user_confirmed",
            &payload,
        )
        .await;

        Ok(request)
    }

    /// Guardian confirms transfer
    pub async fn guardian_confirms_transfer(
        &self,
        transfer_id: i64,
        guardian_user_id: i64,
    ) -> Result<AgeTransferRequest, GuardianError> {
        let request = sqlx::query_as::<_, AgeTransferRequest>(
            "SELECT atr.* FROM age_transfer_requests atr
             JOIN guardian_relationships gr ON atr.guardian_relationship_id = gr.id
             WHERE atr.id = $1 AND gr.guardian_user_id = $2",
        )
        .bind(transfer_id)
        .bind(guardian_user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::TransferNotAvailable)?;

        if request.transfer_state != "GUARDIAN_NOTIFIED" {
            return Err(GuardianError::TransferNotAvailable);
        }

        let now = Utc::now();

        // Complete transfer
        sqlx::query(
            "UPDATE age_transfer_requests 
             SET transfer_state = 'COMPLETED', guardian_confirmed_at = $2, 
                 assets_transferred = TRUE, contracts_transferred = TRUE,
                 permissions_transferred = TRUE, guardian_permissions_revoked_at = $2,
                 completed_at = $2, updated_at = NOW()
             WHERE id = $1",
        )
        .bind(transfer_id)
        .bind(now)
        .execute(&self.pool)
        .await?;

        // Update user to adult
        sqlx::query(
            "UPDATE user_verification_profiles 
             SET age_verification_state = 'ADULT_ACTIVE', updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(request.user_id)
        .execute(&self.pool)
        .await?;

        // Terminate guardian relationship
        sqlx::query(
            "UPDATE guardian_relationships 
             SET relationship_state = 'TERMINATED', updated_at = NOW()
             WHERE id = $1",
        )
        .bind(request.guardian_relationship_id)
        .execute(&self.pool)
        .await?;

        // Revoke all guardian permissions
        sqlx::query(
            "UPDATE guardian_permissions SET is_granted = FALSE 
             WHERE guardian_relationship_id = $1",
        )
        .bind(request.guardian_relationship_id)
        .execute(&self.pool)
        .await?;

        let payload = serde_json::json!({
            "transfer_id": transfer_id,
            "user_id": request.user_id,
            "completed_at": now
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "user",
            request.user_id,
            "guardian.transfer.completed",
            &payload,
        )
        .await;

        Ok(request)
    }

    /// Auto-transfer if guardian doesn't respond within 30 days
    pub async fn auto_transfer_expired(&self) -> Result<Vec<AgeTransferRequest>, GuardianError> {
        let requests = sqlx::query_as::<_, AgeTransferRequest>(
            "SELECT atr.* FROM age_transfer_requests atr
             WHERE atr.transfer_state = 'PENDING' 
               AND atr.created_at < NOW() - INTERVAL '30 days'
               AND NOT EXISTS (
                   SELECT 1 FROM age_transfer_requests a2
                   WHERE a2.user_id = atr.user_id AND a2.transfer_state = 'COMPLETED'
               )",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(GuardianError::from)?;

        for request in &requests {
            let now = Utc::now();

            sqlx::query(
                "UPDATE age_transfer_requests 
                 SET transfer_state = 'COMPLETED', assets_transferred = TRUE,
                     contracts_transferred = TRUE, permissions_transferred = TRUE,
                     guardian_permissions_revoked_at = $2, completed_at = $2, updated_at = NOW()
                 WHERE id = $1",
            )
            .bind(request.id)
            .bind(now)
            .execute(&self.pool)
            .await?;

            sqlx::query(
                "UPDATE user_verification_profiles 
                 SET age_verification_state = 'ADULT_ACTIVE', updated_at = NOW()
                 WHERE user_id = $1",
            )
            .bind(request.user_id)
            .execute(&self.pool)
            .await?;

            sqlx::query(
                "UPDATE guardian_relationships SET relationship_state = 'TERMINATED', updated_at = NOW()
                 WHERE id = $1",
            )
            .bind(request.guardian_relationship_id)
            .execute(&self.pool)
            .await?;
        }

        Ok(requests)
    }
}
