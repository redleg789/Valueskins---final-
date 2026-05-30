//! Guardian Permission Management
//!
//! All 18 guardian permission types with granular control.
//! Permissions are individually grantable and revocable.

use crate::models::{GuardianError, GuardianPermission, GuardianPermissionResponse, PermissionUpdate};
use sqlx::PgPool;

/// All possible guardian permissions
pub const ALL_PERMISSIONS: &[&str] = &[
    "VIEW_PROFILE",
    "EDIT_PROFILE",
    "VIEW_MESSAGES",
    "SEND_MESSAGES",
    "VIEW_CONTRACTS",
    "APPROVE_CONTRACTS",
    "REJECT_CONTRACTS",
    "VIEW_PAYMENTS",
    "APPROVE_PAYOUTS",
    "REJECT_PAYOUTS",
    "MANAGE_SCHEDULE",
    "VIEW_ANALYTICS",
    "MANAGE_TEAM",
    "DELETE_ACCOUNT",
    "TRANSFER_ACCOUNT",
    "VIEW_DISPUTES",
    "RESOLVE_DISPUTES",
];

/// Minimum required permissions for an active relationship
pub const MINIMUM_PERMISSIONS: &[&str] = &["VIEW_PROFILE", "VIEW_CONTRACTS", "VIEW_PAYMENTS"];

pub struct PermissionService {
    pool: PgPool,
}

impl PermissionService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Seed default permissions for a new guardian relationship
    pub async fn seed_defaults(
        &self,
        relationship_id: i64,
    ) -> Result<(), GuardianError> {
        for permission in ALL_PERMISSIONS {
            let is_granted = MINIMUM_PERMISSIONS.contains(permission);
            sqlx::query(
                "INSERT INTO guardian_permissions 
                 (guardian_relationship_id, permission, is_granted, granted_by)
                 VALUES ($1, $2, $3, 'system')
                 ON CONFLICT (guardian_relationship_id, permission) DO NOTHING",
            )
            .bind(relationship_id)
            .bind(permission)
            .bind(is_granted)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    /// Update permissions for a relationship
    /// Validates: cannot revoke minimum required permissions
    pub async fn update_permissions(
        &self,
        relationship_id: i64,
        guardian_user_id: i64,
        updates: &[PermissionUpdate],
    ) -> Result<Vec<GuardianPermissionResponse>, GuardianError> {
        // Verify guardian owns this relationship
        let owner: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM guardian_relationships 
             WHERE id = $1 AND guardian_user_id = $2 AND relationship_state = 'ACTIVE')",
        )
        .bind(relationship_id)
        .bind(guardian_user_id)
        .fetch_one(&self.pool)
        .await?;

        if !owner {
            return Err(GuardianError::Forbidden(
                "Not authorized to modify these permissions".to_string(),
            ));
        }

        for update in updates {
            // Cannot revoke minimum permissions
            if !update.is_granted && MINIMUM_PERMISSIONS.contains(&update.permission.as_str()) {
                return Err(GuardianError::PermissionDenied(format!(
                    "Cannot revoke minimum required permission: {}",
                    update.permission
                )));
            }

            sqlx::query(
                "UPDATE guardian_permissions 
                 SET is_granted = $3, granted_by = 'guardian_self', updated_at = NOW()
                 WHERE guardian_relationship_id = $1 AND permission = $2",
            )
            .bind(relationship_id)
            .bind(&update.permission)
            .bind(update.is_granted)
            .execute(&self.pool)
            .await?;
        }

        // Publish event
        let payload = serde_json::json!({
            "relationship_id": relationship_id,
            "guardian_user_id": guardian_user_id,
            "updates": updates
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "guardian_relationship",
            relationship_id,
            "guardian.permissions.changed",
            &payload,
        )
        .await;

        self.get_permissions(relationship_id).await
    }

    /// Get all permissions for a relationship
    pub async fn get_permissions(
        &self,
        relationship_id: i64,
    ) -> Result<Vec<GuardianPermissionResponse>, GuardianError> {
        let permissions = sqlx::query_as::<_, GuardianPermission>(
            "SELECT * FROM guardian_permissions WHERE guardian_relationship_id = $1 ORDER BY permission",
        )
        .bind(relationship_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(permissions
            .into_iter()
            .map(|p| GuardianPermissionResponse {
                permission: p.permission,
                is_granted: p.is_granted,
                granted_at: p.granted_at,
            })
            .collect())
    }

    /// Check if a guardian has a specific permission for a minor
    pub async fn check_permission(
        &self,
        guardian_user_id: i64,
        minor_user_id: i64,
        required_permission: &str,
    ) -> Result<bool, GuardianError> {
        let result: Option<bool> = sqlx::query_scalar(
            "SELECT gp.is_granted
             FROM guardian_permissions gp
             JOIN guardian_relationships gr ON gp.guaridan_relationship_id = gr.id
             WHERE gr.guardian_user_id = $1 AND gr.minor_user_id = $2 
               AND gr.relationship_state = 'ACTIVE'
               AND gp.permission = $3
               AND gp.is_granted = TRUE",
        )
        .bind(guardian_user_id)
        .bind(minor_user_id)
        .bind(required_permission)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.unwrap_or(false))
    }

    /// Check if minor has minimum permissions configured
    pub async fn has_minimum_permissions(
        &self,
        relationship_id: i64,
    ) -> Result<bool, GuardianError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM guardian_permissions 
             WHERE guardian_relationship_id = $1 
             AND permission = ANY($2) 
             AND is_granted = TRUE",
        )
        .bind(relationship_id)
        .bind(MINIMUM_PERMISSIONS)
        .fetch_one(&self.pool)
        .await?;

        Ok(count == MINIMUM_PERMISSIONS.len() as i64)
    }
}
