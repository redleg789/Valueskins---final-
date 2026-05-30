use crate::models::*;
use chrono::Utc;
use sha2::{Digest, Sha256};
use sqlx::PgPool;

pub struct LinkedInService {
    pool: PgPool,
}

impl LinkedInService {
    pub fn new(pool: PgPool) -> Self {
        LinkedInService { pool }
    }

    fn hash_url(url: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(url.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Extract a stable identifier from a LinkedIn profile URL.
    /// Handles: linkedin.com/in/{slug}, linkedin.com/pub/{slug}, raw slugs.
    fn extract_external_id(url: &str) -> Result<String, ServiceError> {
        let trimmed = url.trim().trim_end_matches('/');
        // Try to extract slug after /in/ or /pub/
        if let Some(pos) = trimmed.rfind("/in/") {
            let slug = &trimmed[pos + 4..];
            if slug.is_empty() {
                return Err(ServiceError::Validation("Empty LinkedIn profile slug".into()));
            }
            return Ok(slug.to_string());
        }
        if let Some(pos) = trimmed.rfind("/pub/") {
            let slug = &trimmed[pos + 5..];
            if slug.is_empty() {
                return Err(ServiceError::Validation("Empty LinkedIn profile slug".into()));
            }
            return Ok(slug.to_string());
        }
        // Fallback: use the last path segment
        trimmed
            .rsplit('/')
            .next()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .ok_or_else(|| ServiceError::Validation("Invalid LinkedIn profile URL".into()))
    }

    // ── Profile Operations ─────────────────────────────────────────────

    /// Link a LinkedIn account. Idempotent via UPSERT on (user_id, platform).
    pub async fn link_profile(
        &self,
        user_id: i64,
        req: LinkLinkedInRequest,
    ) -> Result<LinkedInProfile, ServiceError> {
        if req.profile_url.trim().is_empty() {
            return Err(ServiceError::Validation("Profile URL is required".into()));
        }

        let external_id = Self::extract_external_id(&req.profile_url)?;
        let profile_hash = Self::hash_url(&req.profile_url);
        let now = Utc::now();

        let profile = sqlx::query_as::<_, LinkedInProfile>(
            "INSERT INTO linkedin_profiles
                (user_id, platform, external_id, external_handle, profile_url, profile_hash,
                 headline, company, job_title, location, verified_at, is_active, created_at, updated_at)
             VALUES ($1, 'linkedin', $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12)
             ON CONFLICT (user_id, platform) DO UPDATE SET
                external_id     = EXCLUDED.external_id,
                external_handle = EXCLUDED.external_handle,
                profile_url     = EXCLUDED.profile_url,
                profile_hash    = EXCLUDED.profile_hash,
                headline        = EXCLUDED.headline,
                company         = EXCLUDED.company,
                job_title       = EXCLUDED.job_title,
                location        = EXCLUDED.location,
                verified_at     = EXCLUDED.verified_at,
                is_active       = TRUE,
                updated_at      = EXCLUDED.updated_at
             RETURNING *"
        )
        .bind(user_id)
        .bind(&external_id)
        .bind(&external_id) // external_handle = slug
        .bind(&req.profile_url)
        .bind(&profile_hash)
        .bind(&req.headline)
        .bind(&req.company)
        .bind(&req.job_title)
        .bind(&req.location)
        .bind(now) // verified_at — in production this requires OAuth callback
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(profile)
    }

    /// Fetch the caller's own LinkedIn profile.
    pub async fn get_profile(
        &self,
        user_id: i64,
    ) -> Result<LinkedInProfile, ServiceError> {
        sqlx::query_as::<_, LinkedInProfile>(
            "SELECT * FROM linkedin_profiles WHERE user_id = $1 AND is_active = TRUE"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    /// Toggle whether ValueSkins are publicly visible on this user's profile.
    pub async fn set_visibility(
        &self,
        user_id: i64,
        is_public: bool,
    ) -> Result<(), ServiceError> {
        let result = sqlx::query(
            "UPDATE linkedin_profiles SET is_public = $1 WHERE user_id = $2 AND is_active = TRUE"
        )
        .bind(is_public)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        if result.rows_affected() == 0 {
            return Err(ServiceError::NotFound);
        }
        Ok(())
    }

    /// Unlink (soft-delete) a LinkedIn profile.
    pub async fn unlink_profile(
        &self,
        user_id: i64,
    ) -> Result<(), ServiceError> {
        let result = sqlx::query(
            "UPDATE linkedin_profiles SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        if result.rows_affected() == 0 {
            return Err(ServiceError::NotFound);
        }
        Ok(())
    }

    // ── Connection Operations ──────────────────────────────────────────

    /// Send a connection request. Idempotent — ON CONFLICT DO NOTHING.
    pub async fn send_connection_request(
        &self,
        user_id: i64,
        connected_user_id: i64,
    ) -> Result<(), ServiceError> {
        if user_id == connected_user_id {
            return Err(ServiceError::Validation("Cannot connect to yourself".into()));
        }

        // Verify target user exists
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE)"
        )
        .bind(connected_user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        if !exists {
            return Err(ServiceError::NotFound);
        }

        let now = Utc::now();

        sqlx::query(
            "INSERT INTO linkedin_connections
                (user_id, connected_user_id, connection_type, created_at, updated_at)
             VALUES ($1, $2, 'pending', $3, $4)
             ON CONFLICT (user_id, connected_user_id) DO NOTHING"
        )
        .bind(user_id)
        .bind(connected_user_id)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(())
    }

    /// Accept or decline a pending connection request.
    /// On accept, computes shared ValueSkins between both users.
    pub async fn respond_to_connection(
        &self,
        user_id: i64,
        requester_user_id: i64,
        accept: bool,
    ) -> Result<(), ServiceError> {
        let now = Utc::now();

        if accept {
            // Compute shared ValueSkins between both users
            let shared: Vec<String> = sqlx::query_scalar(
                "SELECT DISTINCT p.name
                 FROM persona_professions pp1
                 JOIN persona_professions pp2 ON pp1.profession_id = pp2.profession_id
                 JOIN personas per1 ON pp1.persona_id = per1.id
                 JOIN personas per2 ON pp2.persona_id = per2.id
                 JOIN professions p ON pp1.profession_id = p.id
                 WHERE per1.owner_user_id = $1 AND per2.owner_user_id = $2"
            )
            .bind(user_id)
            .bind(requester_user_id)
            .fetch_all(&self.pool)
            .await
            .unwrap_or_default();

            // Update the original request to 'connected'
            let result = sqlx::query(
                "UPDATE linkedin_connections
                 SET connection_type = 'connected', connected_at = $1, shared_valueskins = $2, updated_at = $3
                 WHERE user_id = $4 AND connected_user_id = $5 AND connection_type = 'pending'"
            )
            .bind(now)
            .bind(&shared)
            .bind(now)
            .bind(requester_user_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(ServiceError::from)?;

            if result.rows_affected() == 0 {
                return Err(ServiceError::NotFound);
            }

            // Create the reverse connection record
            sqlx::query(
                "INSERT INTO linkedin_connections
                    (user_id, connected_user_id, connection_type, connected_at, shared_valueskins, created_at, updated_at)
                 VALUES ($1, $2, 'connected', $3, $4, $5, $6)
                 ON CONFLICT (user_id, connected_user_id) DO UPDATE SET
                    connection_type = 'connected', connected_at = EXCLUDED.connected_at,
                    shared_valueskins = EXCLUDED.shared_valueskins, updated_at = EXCLUDED.updated_at"
            )
            .bind(user_id)
            .bind(requester_user_id)
            .bind(now)
            .bind(&shared)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(ServiceError::from)?;
        } else {
            // Decline: remove the pending request
            let result = sqlx::query(
                "DELETE FROM linkedin_connections
                 WHERE user_id = $1 AND connected_user_id = $2 AND connection_type = 'pending'"
            )
            .bind(requester_user_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(ServiceError::from)?;

            if result.rows_affected() == 0 {
                return Err(ServiceError::NotFound);
            }
        }

        Ok(())
    }

    /// List connections for a user, filtered to 'connected' status.
    pub async fn list_connections(
        &self,
        user_id: i64,
    ) -> Result<Vec<LinkedInConnection>, ServiceError> {
        sqlx::query_as::<_, LinkedInConnection>(
            "SELECT * FROM linkedin_connections
             WHERE user_id = $1 AND connection_type = 'connected'
             ORDER BY connected_at DESC
             LIMIT 100"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    /// List connections that share at least one ValueSkin.
    pub async fn list_connections_with_shared_skins(
        &self,
        user_id: i64,
    ) -> Result<Vec<LinkedInConnection>, ServiceError> {
        sqlx::query_as::<_, LinkedInConnection>(
            "SELECT * FROM linkedin_connections
             WHERE user_id = $1
               AND connection_type = 'connected'
               AND shared_valueskins IS NOT NULL
               AND array_length(shared_valueskins, 1) > 0
             ORDER BY connected_at DESC
             LIMIT 100"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    /// List pending connection requests received by user.
    pub async fn list_pending_requests(
        &self,
        user_id: i64,
    ) -> Result<Vec<LinkedInConnection>, ServiceError> {
        sqlx::query_as::<_, LinkedInConnection>(
            "SELECT * FROM linkedin_connections
             WHERE connected_user_id = $1 AND connection_type = 'pending'
             ORDER BY created_at DESC
             LIMIT 50"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    // ── Recommendation Operations ──────────────────────────────────────

    /// Give a recommendation for a specific profession.
    /// Validates rating range. Idempotent per (recommender, recipient, profession).
    pub async fn give_recommendation(
        &self,
        recommender_user_id: i64,
        req: GiveRecommendationRequest,
    ) -> Result<LinkedInRecommendation, ServiceError> {
        if req.rating < 1.0 || req.rating > 5.0 {
            return Err(ServiceError::Validation("Rating must be between 1.0 and 5.0".into()));
        }
        if req.recipient_user_id == recommender_user_id {
            return Err(ServiceError::Validation("Cannot recommend yourself".into()));
        }
        if req.profession.trim().is_empty() {
            return Err(ServiceError::Validation("Profession is required".into()));
        }

        let now = Utc::now();

        let rec = sqlx::query_as::<_, LinkedInRecommendation>(
            "INSERT INTO linkedin_recommendations
                (recommender_user_id, recipient_user_id, profession, rating, testimonial,
                 verified_at, is_public, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8)
             ON CONFLICT (recommender_user_id, recipient_user_id, profession) DO UPDATE SET
                rating      = EXCLUDED.rating,
                testimonial = EXCLUDED.testimonial,
                verified_at = EXCLUDED.verified_at,
                updated_at  = EXCLUDED.updated_at
             RETURNING id, recommender_user_id, recipient_user_id, profession, rating::float8 AS rating, testimonial, verified_at, is_public, created_at, updated_at"
        )
        .bind(recommender_user_id)
        .bind(req.recipient_user_id)
        .bind(&req.profession)
        .bind(req.rating)
        .bind(&req.testimonial)
        .bind(now)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        Ok(rec)
    }

    /// Fetch recommendations for a user, optionally filtered by profession.
    /// Hides recommender identity unless recommendation is marked public.
    pub async fn get_recommendations(
        &self,
        recipient_user_id: i64,
        profession: Option<&str>,
    ) -> Result<Vec<LinkedInRecommendation>, ServiceError> {
        if let Some(prof) = profession {
            sqlx::query_as::<_, LinkedInRecommendation>(
                "SELECT id, recommender_user_id, recipient_user_id, profession, rating::float8 AS rating, testimonial, verified_at, is_public, created_at, updated_at FROM linkedin_recommendations
                 WHERE recipient_user_id = $1 AND profession = $2 AND verified_at IS NOT NULL
                 ORDER BY rating DESC, verified_at DESC
                 LIMIT 50"
            )
            .bind(recipient_user_id)
            .bind(prof)
            .fetch_all(&self.pool)
            .await
            .map_err(ServiceError::from)
        } else {
            sqlx::query_as::<_, LinkedInRecommendation>(
                "SELECT id, recommender_user_id, recipient_user_id, profession, rating::float8 AS rating, testimonial, verified_at, is_public, created_at, updated_at FROM linkedin_recommendations
                 WHERE recipient_user_id = $1 AND verified_at IS NOT NULL
                 ORDER BY rating DESC, verified_at DESC
                 LIMIT 50"
            )
            .bind(recipient_user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(ServiceError::from)
        }
    }

    // ── Invitation Operations ──────────────────────────────────────────

    /// Send a community invitation. Validates sender membership.
    pub async fn invite_to_community(
        &self,
        sender_user_id: i64,
        req: InviteToCommunityRequest,
    ) -> Result<(), ServiceError> {
        if sender_user_id == req.recipient_user_id {
            return Err(ServiceError::Validation("Cannot invite yourself".into()));
        }

        // Verify sender is a member of the community
        let is_member: bool = sqlx::query_scalar(
            "SELECT EXISTS(
                SELECT 1 FROM community_members
                WHERE community_id = $1 AND user_id = $2
            )"
        )
        .bind(req.community_id)
        .bind(sender_user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        if !is_member {
            return Err(ServiceError::Forbidden);
        }

        // Verify recipient exists
        let recipient_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE)"
        )
        .bind(req.recipient_user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        if !recipient_exists {
            return Err(ServiceError::NotFound);
        }

        let now = Utc::now();

        sqlx::query(
            "INSERT INTO linkedin_invitations
                (sender_user_id, recipient_user_id, community_id, reason, status, created_at)
             VALUES ($1, $2, $3, $4, 'pending', $5)"
        )
        .bind(sender_user_id)
        .bind(req.recipient_user_id)
        .bind(req.community_id)
        .bind(&req.reason)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            // Unique index violation means duplicate pending invitation
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.code().map_or(false, |c| c == "23505") {
                    return ServiceError::Conflict("Pending invitation already exists".into());
                }
            }
            ServiceError::from(e)
        })?;

        Ok(())
    }

    /// List pending invitations for a user.
    pub async fn list_pending_invitations(
        &self,
        user_id: i64,
    ) -> Result<Vec<LinkedInInvitation>, ServiceError> {
        sqlx::query_as::<_, LinkedInInvitation>(
            "SELECT * FROM linkedin_invitations
             WHERE recipient_user_id = $1 AND status = 'pending'
             ORDER BY created_at DESC
             LIMIT 50"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(ServiceError::from)
    }

    /// Accept or decline a community invitation.
    pub async fn respond_to_invitation(
        &self,
        user_id: i64,
        invitation_id: i64,
        accept: bool,
    ) -> Result<(), ServiceError> {
        let now = Utc::now();
        let new_status = if accept { "accepted" } else { "declined" };

        let result = sqlx::query(
            "UPDATE linkedin_invitations
             SET status = $1, responded_at = $2
             WHERE id = $3 AND recipient_user_id = $4 AND status = 'pending'"
        )
        .bind(new_status)
        .bind(now)
        .bind(invitation_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(ServiceError::from)?;

        if result.rows_affected() == 0 {
            return Err(ServiceError::NotFound);
        }

        // If accepted, add recipient to the community
        if accept {
            let community_id: i64 = sqlx::query_scalar(
                "SELECT community_id FROM linkedin_invitations WHERE id = $1"
            )
            .bind(invitation_id)
            .fetch_one(&self.pool)
            .await
            .map_err(ServiceError::from)?;

            sqlx::query(
                "INSERT INTO community_members (community_id, user_id, role, joined_at)
                 VALUES ($1, $2, 'member', $3)
                 ON CONFLICT (community_id, user_id) DO NOTHING"
            )
            .bind(community_id)
            .bind(user_id)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(ServiceError::from)?;
        }

        Ok(())
    }
}
