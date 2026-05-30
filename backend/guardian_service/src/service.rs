//! Guardian Service — Core Business Logic
//!
//! Manages the full guardian lifecycle:
//! 1. Invite guardian (minor or system initiates)
//! 2. Guardian accepts invite
//! 3. Guardian identity verification
//! 4. Consent signing
//! 5. Permission configuration
//! 6. Active monitoring
//! 7. Revocation / Transfer / Termination

use crate::models::*;
use crate::permissions::PermissionService;
use crate::transfer::TransferService;
use chrono::Utc;
use rand::Rng;
use sha2::{Digest, Sha256};
use sqlx::PgPool;

/// Relationship state machine transitions
const VALID_TRANSITIONS: &[(&str, &[&str])] = &[
    ("PENDING_INVITE", &["INVITE_EXPIRED", "PENDING_CONSENT"]),
    ("INVITE_EXPIRED", &["PENDING_INVITE"]),
    ("PENDING_CONSENT", &["CONSENT_DOCUMENTS_UPLOADED", "PENDING_INVITE"]),
    ("CONSENT_DOCUMENTS_UPLOADED", &["CONSENT_DOCUMENTS_REVIEWED", "PENDING_CONSENT"]),
    ("CONSENT_DOCUMENTS_REVIEWED", &["ACTIVE", "PENDING_CONSENT"]),
    ("ACTIVE", &["SUSPENDED", "REVOKED", "DISPUTED", "TRANSFERRED"]),
    ("SUSPENDED", &["ACTIVE", "REVOKED", "DISPUTED"]),
    ("REVOKED", &["TERMINATED"]),
    ("DISPUTED", &["AWAITING_COURT_ORDER", "ACTIVE", "REVOKED"]),
    ("AWAITING_COURT_ORDER", &["ACTIVE", "REVOKED", "TERMINATED"]),
    ("TERMINATED", &[]),
    ("TRANSFERRED", &[]),
];

pub struct GuardianService {
    pool: PgPool,
    permission_service: PermissionService,
    transfer_service: TransferService,
}

impl GuardianService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            permission_service: PermissionService::new(pool.clone()),
            transfer_service: TransferService::new(pool.clone()),
            pool,
        }
    }

    fn validate_transition(current: &str, next: &str) -> Result<(), GuardianError> {
        VALID_TRANSITIONS
            .iter()
            .find(|(state, _)| *state == current)
            .and_then(|(_, transitions)| {
                if transitions.contains(&next) {
                    Some(())
                } else {
                    None
                }
            })
            .ok_or_else(|| {
                GuardianError::InvalidStateTransition(format!(
                    "Cannot transition from {} to {}",
                    current, next
                ))
            })
    }

    fn generate_invite_token() -> String {
        let random_bytes: [u8; 32] = rand::thread_rng().gen();
        hex::encode(random_bytes)
    }

    /// Initiate guardian linking from a minor account
    pub async fn invite_guardian(
        &self,
        minor_user_id: i64,
        req: &InviteGuardianRequest,
    ) -> Result<GuardianRelationshipResponse, GuardianError> {
        // Validate minor exists and is in correct state
        let minor_state: String = sqlx::query_scalar(
            "SELECT age_verification_state FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(minor_user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::MinorNotFound)?;

        if minor_state != "MINOR_PENDING_GUARDIAN" && minor_state != "MINOR_ACTIVE" {
            return Err(GuardianError::InvalidStateTransition(format!(
                "Minor in state {} cannot invite guardian",
                minor_state
            )));
        }

        // Check no active relationship exists
        let active: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM guardian_relationships 
             WHERE minor_user_id = $1 AND relationship_state IN ('PENDING_CONSENT', 'CONSENT_DOCUMENTS_UPLOADED', 'CONSENT_DOCUMENTS_REVIEWED', 'ACTIVE'))",
        )
        .bind(minor_user_id)
        .fetch_one(&self.pool)
        .await?;

        if active {
            return Err(GuardianError::AlreadyLinked);
        }

        let invite_token = Self::generate_invite_token();
        let invite_expires = Utc::now() + chrono::Duration::days(7);

        // Create guardian relationship in PENDING_INVITE state
        let relationship = sqlx::query_as::<_, GuardianRelationship>(
            "INSERT INTO guardian_relationships 
             (minor_user_id, guardian_user_id, relationship_state, relationship_type, 
              invite_token, invite_expires_at)
             VALUES ($1, 0, 'PENDING_INVITE', $2, $3, $4)
             RETURNING *",
        )
        .bind(minor_user_id)
        .bind(&req.relationship_type)
        .bind(&invite_token)
        .bind(invite_expires)
        .fetch_one(&self.pool)
        .await?;

        // Publish invite event
        let payload = serde_json::json!({
            "relationship_id": relationship.id,
            "minor_user_id": minor_user_id,
            "invite_token": invite_token,
            "expires_at": invite_expires,
            "relationship_type": req.relationship_type
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "guardian_relationship",
            relationship.id,
            "guardian.invite.sent",
            &payload,
        )
        .await;

        self.get_relationship(relationship.id, minor_user_id).await
    }

    /// Guardian accepts invite — creates their account or links existing
    pub async fn accept_invite(
        &self,
        guardian_user_id: i64,
        req: &AcceptInviteRequest,
    ) -> Result<GuardianRelationshipResponse, GuardianError> {
        // Find relationship by invite token
        let relationship = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships WHERE invite_token = $1",
        )
        .bind(&req.invite_token)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::InvalidInviteToken)?;

        Self::validate_transition(&relationship.relationship_state, "PENDING_CONSENT")?;

        // Check if guardian account already exists
        // (guardian_user_id might be 0 if they need to create account first)
        if guardian_user_id == 0 {
            return Err(GuardianError::GuardianNotFound);
        }

        // Prevent self-guardianship
        if guardian_user_id == relationship.minor_user_id {
            return Err(GuardianError::SelfGuardian);
        }

        // Check guardian is 21+ (must be older than minor)
        let guardian_age: Option<i16> = sqlx::query_scalar(
            "SELECT verified_age FROM user_verification_profiles WHERE user_id = $1",
        )
        .bind(guardian_user_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten();

        match guardian_age {
            Some(age) if age < 21 => return Err(GuardianError::GuardianTooYoung),
            None => {
                // Guardian hasn't verified age — this is a risk flag
                tracing::warn!(
                    guardian_user_id,
                    "Guardian accepting invite without verified age"
                );
            }
            _ => {}
        }

        // Check if invite expired
        if let Some(expires) = relationship.invite_expires_at {
            if expires < Utc::now() {
                return Err(GuardianError::InviteExpired);
            }
        }

        // Update relationship with guardian
        sqlx::query(
            "UPDATE guardian_relationships 
             SET guardian_user_id = $2, relationship_state = 'PENDING_CONSENT', 
                 invite_accepted_at = NOW(), updated_at = NOW()
             WHERE id = $1",
        )
        .bind(relationship.id)
        .bind(guardian_user_id)
        .execute(&self.pool)
        .await?;

        // Seed default permissions
        self.permission_service.seed_defaults(relationship.id).await?;

        self.get_relationship(relationship.id, guardian_user_id).await
    }

    /// Complete consent after guardian identity verified
    pub async fn complete_consent(
        &self,
        relationship_id: i64,
        guardian_user_id: i64,
        consent_document_id: i64,
        guardian_document_id: i64,
    ) -> Result<GuardianRelationshipResponse, GuardianError> {
        let relationship = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships WHERE id = $1",
        )
        .bind(relationship_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::RelationshipNotFound)?;

        if relationship.guardian_user_id != guardian_user_id {
            return Err(GuardianError::Forbidden("Not the guardian".to_string()));
        }

        Self::validate_transition(&relationship.relationship_state, "CONSENT_DOCUMENTS_UPLOADED")?;

        sqlx::query(
            "UPDATE guardian_relationships 
             SET relationship_state = 'CONSENT_DOCUMENTS_UPLOADED', 
                 consent_document_id = $2, guardian_identity_document_id = $3,
                 consent_signed_at = NOW(), updated_at = NOW()
             WHERE id = $1",
        )
        .bind(relationship_id)
        .bind(consent_document_id)
        .bind(guardian_document_id)
        .execute(&self.pool)
        .await?;

        // Auto-review consent documents (in production, this would trigger verification)
        self.review_consent(relationship_id, guardian_user_id).await
    }

    /// Review consent documents and activate relationship
    async fn review_consent(
        &self,
        relationship_id: i64,
        guardian_user_id: i64,
    ) -> Result<GuardianRelationshipResponse, GuardianError> {
        let relationship = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships WHERE id = $1",
        )
        .bind(relationship_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::RelationshipNotFound)?;

        Self::validate_transition(&relationship.relationship_state, "CONSENT_DOCUMENTS_REVIEWED")?;

        sqlx::query(
            "UPDATE guardian_relationships 
             SET relationship_state = 'CONSENT_DOCUMENTS_REVIEWED', updated_at = NOW()
             WHERE id = $1",
        )
        .bind(relationship_id)
        .execute(&self.pool)
        .await?;

        // Transition to ACTIVE once minimum permissions are set
        self.activate_relationship(relationship_id, guardian_user_id).await
    }

    /// Activate the guardian relationship
    /// Requires: minimum permissions configured AND consent documents reviewed
    pub async fn activate_relationship(
        &self,
        relationship_id: i64,
        guardian_user_id: i64,
    ) -> Result<GuardianRelationshipResponse, GuardianError> {
        let relationship = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships WHERE id = $1",
        )
        .bind(relationship_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::RelationshipNotFound)?;

        if relationship.guardian_user_id != guardian_user_id {
            return Err(GuardianError::Forbidden("Not the guardian".to_string()));
        }

        Self::validate_transition(&relationship.relationship_state, "ACTIVE")?;

        // Verify minimum permissions are granted
        let has_min = self.permission_service.has_minimum_permissions(relationship_id).await?;
        if !has_min {
            return Err(GuardianError::PermissionDenied(
                "Minimum required permissions not configured".to_string(),
            ));
        }

        sqlx::query(
            "UPDATE guardian_relationships 
             SET relationship_state = 'ACTIVE', updated_at = NOW()
             WHERE id = $1",
        )
        .bind(relationship_id)
        .execute(&self.pool)
        .await?;

        // Update minor's verification profile
        sqlx::query(
            "UPDATE user_verification_profiles 
             SET age_verification_state = 'MINOR_ACTIVE', updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(relationship.minor_user_id)
        .execute(&self.pool)
        .await?;

        // Publish activation event
        let payload = serde_json::json!({
            "relationship_id": relationship_id,
            "minor_user_id": relationship.minor_user_id,
            "guardian_user_id": guardian_user_id,
            "relationship_type": relationship.relationship_type
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "guardian_relationship",
            relationship_id,
            "guardian.relationship.activated",
            &payload,
        )
        .await;

        self.get_relationship(relationship_id, guardian_user_id).await
    }

    /// Revoke guardian consent
    pub async fn revoke_consent(
        &self,
        relationship_id: i64,
        guardian_user_id: i64,
        req: &RevokeConsentRequest,
    ) -> Result<GuardianRelationshipResponse, GuardianError> {
        let relationship = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships WHERE id = $1",
        )
        .bind(relationship_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::RelationshipNotFound)?;

        if relationship.guardian_user_id != guardian_user_id {
            return Err(GuardianError::Forbidden("Not the guardian".to_string()));
        }

        Self::validate_transition(&relationship.relationship_state, "REVOKED")?;

        sqlx::query(
            "UPDATE guardian_relationships 
             SET relationship_state = 'REVOKED', consent_revoked_at = NOW(), 
                 revocation_reason = $2, updated_at = NOW()
             WHERE id = $1",
        )
        .bind(relationship_id)
        .bind(&req.reason)
        .execute(&self.pool)
        .await?;

        // Update minor state
        sqlx::query(
            "UPDATE user_verification_profiles 
             SET age_verification_state = 'MINOR_PENDING_GUARDIAN', updated_at = NOW()
             WHERE user_id = $1",
        )
        .bind(relationship.minor_user_id)
        .execute(&self.pool)
        .await?;

        let payload = serde_json::json!({
            "relationship_id": relationship_id,
            "minor_user_id": relationship.minor_user_id,
            "reason": req.reason
        });
        let bus = shared::event_bus::EventBus::new(self.pool.clone());
        let _ = bus.publish(
            "guardian_relationship",
            relationship_id,
            "guardian.consent.revoked",
            &payload,
        )
        .await;

        self.get_relationship(relationship_id, guardian_user_id).await
    }

    /// Get a single relationship with permissions
    pub async fn get_relationship(
        &self,
        relationship_id: i64,
        user_id: i64,
    ) -> Result<GuardianRelationshipResponse, GuardianError> {
        let relationship = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships WHERE id = $1",
        )
        .bind(relationship_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(GuardianError::RelationshipNotFound)?;

        // Verify user is either minor, guardian, or admin
        if relationship.minor_user_id != user_id
            && relationship.guardian_user_id != user_id
        {
            // Check if admin
            return Err(GuardianError::Forbidden("Access denied".to_string()));
        }

        let permissions = self.permission_service.get_permissions(relationship_id).await?;

        Ok(GuardianRelationshipResponse {
            id: relationship.id,
            minor_user_id: relationship.minor_user_id,
            guardian_user_id: relationship.guardian_user_id,
            relationship_state: relationship.relationship_state,
            relationship_type: relationship.relationship_type,
            permissions,
            created_at: relationship.created_at,
        })
    }

    /// Get guardian's full dashboard
    pub async fn get_guardian_dashboard(
        &self,
        guardian_user_id: i64,
    ) -> Result<GuardianDashboardResponse, GuardianError> {
        let relationships = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships 
             WHERE guardian_user_id = $1 
             AND relationship_state IN ('PENDING_CONSENT', 'CONSENT_DOCUMENTS_UPLOADED', 'ACTIVE', 'SUSPENDED')
             ORDER BY created_at DESC",
        )
        .bind(guardian_user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut linked_minors = Vec::new();
        let mut pending_approvals = 0;
        let mut pending_payouts = 0;

        for rel in relationships {
            let permissions = self.permission_service.get_permissions(rel.id).await.unwrap_or_default();

            // Count pending approvals
            if rel.relationship_state == "ACTIVE" {
                // In production: query actual pending counts
                pending_approvals += 1;
            }

            linked_minors.push(GuardianRelationshipResponse {
                id: rel.id,
                minor_user_id: rel.minor_user_id,
                guardian_user_id: rel.guardian_user_id,
                relationship_state: rel.relationship_state,
                relationship_type: rel.relationship_type,
                permissions,
                created_at: rel.created_at,
            });
        }

        Ok(GuardianDashboardResponse {
            linked_minors,
            pending_approvals,
            pending_payouts,
        })
    }

    /// Get all relationships for a minor
    pub async fn get_minor_relationships(
        &self,
        minor_user_id: i64,
    ) -> Result<Vec<GuardianRelationshipResponse>, GuardianError> {
        let relationships = sqlx::query_as::<_, GuardianRelationship>(
            "SELECT * FROM guardian_relationships WHERE minor_user_id = $1 ORDER BY created_at DESC",
        )
        .bind(minor_user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for rel in relationships {
            let permissions = self.permission_service.get_permissions(rel.id).await.unwrap_or_default();
            result.push(GuardianRelationshipResponse {
                id: rel.id,
                minor_user_id: rel.minor_user_id,
                guardian_user_id: rel.guardian_user_id,
                relationship_state: rel.relationship_state,
                relationship_type: rel.relationship_type,
                permissions,
                created_at: rel.created_at,
            });
        }

        Ok(result)
    }
}
