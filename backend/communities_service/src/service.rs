//! Community Service Layer

use sqlx::PgPool;
use crate::models::*;

pub struct CommunityService {
    pool: PgPool,
}

#[derive(Debug)]
pub enum ServiceError {
    NotFound,
    NotMember,
    NotEligible { reason: String },
    AlreadyMember,
    OwnerCannotLeave,
    Forbidden,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for ServiceError {
    fn from(e: sqlx::Error) -> Self {
        ServiceError::Database(e)
    }
}

impl CommunityService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ── Create Community ───────────────────────────────────────────────

    pub async fn create_community(
        &self,
        owner_user_id: i64,
        req: CreateCommunityRequest,
    ) -> Result<i64, ServiceError> {
        // INSERT community
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO communities
                (owner_user_id, name, description, visibility, gate_type, required_tier)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            "#
        )
        .bind(owner_user_id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.visibility)
        .bind(&req.gate_type)
        .bind(&req.required_tier)
        .fetch_one(&self.pool)
        .await?;

        // INSERT owner as member
        sqlx::query(
            "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'owner')"
        )
        .bind(id)
        .bind(owner_user_id)
        .execute(&self.pool)
        .await?;

        // INSERT gates if specific
        if req.gate_type == "specific" {
            for profession in req.allowed_professions {
                sqlx::query(
                    "INSERT INTO community_gates (community_id, profession) VALUES ($1, $2)"
                )
                .bind(id)
                .bind(&profession)
                .execute(&self.pool)
                .await?;
            }
        }

        Ok(id)
    }

    // ── Read Communities ───────────────────────────────────────────────

    pub async fn list_communities(
        &self,
        viewer_user_id: i64,
        _search: Option<String>,
    ) -> Result<Vec<CommunityResponse>, ServiceError> {
        // Get all public communities + private ones where viewer is a member
        let communities = sqlx::query_as::<_, Community>(
            r#"
            SELECT c.* FROM communities c
            WHERE c.visibility = 'public'
            OR c.id IN (
                SELECT community_id FROM community_members
                WHERE user_id = $1
            )
            ORDER BY c.created_at DESC
            LIMIT 100
            "#
        )
        .bind(viewer_user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut responses = Vec::new();
        for comm in communities {
            let gates: Vec<String> = sqlx::query_scalar(
                "SELECT profession FROM community_gates WHERE community_id = $1"
            )
            .bind(comm.id)
            .fetch_all(&self.pool)
            .await?;

            let is_member: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2)"
            )
            .bind(comm.id)
            .bind(viewer_user_id)
            .fetch_one(&self.pool)
            .await?;

            // Check eligibility
            let (can_join, reason) = self.check_eligibility(viewer_user_id, &comm).await?;

            responses.push(CommunityResponse {
                id: comm.id,
                name: comm.name,
                description: comm.description,
                avatar_color: comm.avatar_color,
                avatar_abbr: comm.avatar_abbr,
                visibility: comm.visibility,
                gate_type: comm.gate_type,
                gates,
                required_tier: comm.required_tier,
                member_count: comm.member_count,
                post_count: comm.post_count,
                is_member,
                can_join,
                join_blocked_reason: reason,
            });
        }

        Ok(responses)
    }

    pub async fn get_community(
        &self,
        id: i64,
        viewer_user_id: i64,
    ) -> Result<CommunityResponse, ServiceError> {
        let comm = sqlx::query_as::<_, Community>(
            "SELECT * FROM communities WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let gates: Vec<String> = sqlx::query_scalar(
            "SELECT profession FROM community_gates WHERE community_id = $1"
        )
        .bind(id)
        .fetch_all(&self.pool)
        .await?;

        let is_member: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2)"
        )
        .bind(id)
        .bind(viewer_user_id)
        .fetch_one(&self.pool)
        .await?;

        let (can_join, reason) = self.check_eligibility(viewer_user_id, &comm).await?;

        Ok(CommunityResponse {
            id: comm.id,
            name: comm.name,
            description: comm.description,
            avatar_color: comm.avatar_color,
            avatar_abbr: comm.avatar_abbr,
            visibility: comm.visibility,
            gate_type: comm.gate_type,
            gates,
            required_tier: comm.required_tier,
            member_count: comm.member_count,
            post_count: comm.post_count,
            is_member,
            can_join,
            join_blocked_reason: reason,
        })
    }

    // ── Join / Leave Community ─────────────────────────────────────────

    pub async fn join_community(
        &self,
        community_id: i64,
        user_id: i64,
    ) -> Result<(), ServiceError> {
        let comm = sqlx::query_as::<_, Community>(
            "SELECT * FROM communities WHERE id = $1"
        )
        .bind(community_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotFound)?;

        let (can_join, reason) = self.check_eligibility(user_id, &comm).await?;
        if !can_join {
            return Err(ServiceError::NotEligible {
                reason: reason.unwrap_or_default(),
            });
        }

        sqlx::query(
            "INSERT INTO community_members (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(community_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn leave_community(
        &self,
        community_id: i64,
        user_id: i64,
    ) -> Result<(), ServiceError> {
        // Check if user is owner
        let role: String = sqlx::query_scalar(
            "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2"
        )
        .bind(community_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(ServiceError::NotMember)?;

        if role == "owner" {
            return Err(ServiceError::OwnerCannotLeave);
        }

        sqlx::query(
            "DELETE FROM community_members WHERE community_id = $1 AND user_id = $2"
        )
        .bind(community_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ── Members ────────────────────────────────────────────────────────

    pub async fn list_members(
        &self,
        community_id: i64,
        viewer_user_id: i64,
    ) -> Result<Vec<MemberResponse>, ServiceError> {
        // Check viewer is member
        let is_member: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2)"
        )
        .bind(community_id)
        .bind(viewer_user_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_member {
            return Err(ServiceError::Forbidden);
        }

        let members = sqlx::query_as::<_, (i64, String)>(
            r#"
            SELECT cm.user_id, cm.role
            FROM community_members cm
            WHERE cm.community_id = $1
            ORDER BY cm.joined_at ASC
            "#
        )
        .bind(community_id)
        .fetch_all(&self.pool)
        .await?;

        let mut responses = Vec::new();
        for (user_id, role) in members {
            // Fetch real user data from users table
            let user_data: Option<(String, Option<String>)> = sqlx::query_as(
                "SELECT COALESCE(display_name, 'User'), ig_handle FROM users WHERE id = $1"
            )
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;

            let (display_name, ig_handle) = user_data.unwrap_or_else(|| (format!("User {}", user_id), None));

            let professions: Vec<String> = sqlx::query_scalar(
                "SELECT profession FROM user_valueskin_tiers WHERE user_id = $1 ORDER BY profession"
            )
            .bind(user_id)
            .fetch_all(&self.pool)
            .await?;

            let joined_at: chrono::DateTime<chrono::Utc> = sqlx::query_scalar(
                "SELECT joined_at FROM community_members WHERE community_id = $1 AND user_id = $2"
            )
            .bind(community_id)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

            responses.push(MemberResponse {
                user_id,
                display_name,
                ig_handle: ig_handle.unwrap_or_else(|| format!("@user{}", user_id)),
                valueskin_professions: professions,
                role,
                joined_at,
            });
        }

        Ok(responses)
    }

    // ── Posts ──────────────────────────────────────────────────────────

    pub async fn create_post(
        &self,
        community_id: i64,
        author_user_id: i64,
        req: CreatePostRequest,
    ) -> Result<i64, ServiceError> {
        // Check membership
        let is_member: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2)"
        )
        .bind(community_id)
        .bind(author_user_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_member {
            return Err(ServiceError::NotMember);
        }

        let is_announcement = req.is_announcement.unwrap_or(false);

        // Check permissions: announcements only for owner/admin
        if is_announcement {
            let role: String = sqlx::query_scalar(
                "SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2"
            )
            .bind(community_id)
            .bind(author_user_id)
            .fetch_one(&self.pool)
            .await?;

            if !["owner", "admin"].contains(&role.as_str()) {
                return Err(ServiceError::Forbidden);
            }
        }

        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO community_posts
                (community_id, author_user_id, content, is_announcement)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            "#
        )
        .bind(community_id)
        .bind(author_user_id)
        .bind(&req.content)
        .bind(is_announcement)
        .fetch_one(&self.pool)
        .await?;

        Ok(id)
    }

    pub async fn list_posts(
        &self,
        community_id: i64,
        viewer_user_id: i64,
        _limit: i32,
        _offset: i32,
    ) -> Result<Vec<PostResponse>, ServiceError> {
        // Check membership
        let is_member: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2)"
        )
        .bind(community_id)
        .bind(viewer_user_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_member {
            return Err(ServiceError::Forbidden);
        }

        let safe_limit = _limit.max(1).min(100);
        let safe_offset = _offset.max(0);

        let posts = sqlx::query_as::<_, CommunityPost>(
            r#"
            SELECT * FROM community_posts
            WHERE community_id = $1
            ORDER BY is_pinned DESC, created_at DESC
            LIMIT $2 OFFSET $3
            "#
        )
        .bind(community_id)
        .bind(safe_limit)
        .bind(safe_offset)
        .fetch_all(&self.pool)
        .await?;

        let mut responses = Vec::new();
        for post in posts {
            let author_data: Option<(String, Option<String>)> = sqlx::query_as(
                "SELECT COALESCE(display_name, 'User'), ig_handle FROM users WHERE id = $1"
            )
            .bind(post.author_user_id)
            .fetch_optional(&self.pool)
            .await?;

            let (author_name, author_handle) = author_data
                .unwrap_or_else(|| (format!("User {}", post.author_user_id), None));

            let author_profession: Option<String> = sqlx::query_scalar(
                "SELECT profession FROM user_valueskin_tiers WHERE user_id = $1 LIMIT 1"
            )
            .bind(post.author_user_id)
            .fetch_optional(&self.pool)
            .await?;

            responses.push(PostResponse {
                id: post.id,
                community_id: post.community_id,
                author_user_id: post.author_user_id,
                author_display_name: author_name,
                author_handle: author_handle.unwrap_or_else(|| format!("@user{}", post.author_user_id)),
                author_profession,
                content: post.content,
                is_pinned: post.is_pinned,
                is_announcement: post.is_announcement,
                like_count: post.like_count,
                created_at: post.created_at,
            });
        }

        Ok(responses)
    }

    pub async fn like_post(
        &self,
        post_id: i64,
        user_id: i64,
    ) -> Result<(), ServiceError> {
        // Verify user is a member of the post's community
        let is_member: bool = sqlx::query_scalar(
            r#"SELECT EXISTS(
                SELECT 1 FROM community_members cm
                JOIN community_posts cp ON cp.community_id = cm.community_id
                WHERE cp.id = $1 AND cm.user_id = $2
            )"#
        )
        .bind(post_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_member {
            return Err(ServiceError::NotMember);
        }

        sqlx::query(
            "INSERT INTO community_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(post_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn unlike_post(
        &self,
        post_id: i64,
        user_id: i64,
    ) -> Result<(), ServiceError> {
        // Verify user is a member of the post's community
        let is_member: bool = sqlx::query_scalar(
            r#"SELECT EXISTS(
                SELECT 1 FROM community_members cm
                JOIN community_posts cp ON cp.community_id = cm.community_id
                WHERE cp.id = $1 AND cm.user_id = $2
            )"#
        )
        .bind(post_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_member {
            return Err(ServiceError::NotMember);
        }

        sqlx::query(
            "DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2"
        )
        .bind(post_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ── Pricing (Meta Admin) ───────────────────────────────────────────

    pub async fn set_pricing(
        &self,
        admin_user_id: i64,
        req: SetPricingRequest,
    ) -> Result<(), ServiceError> {
        // Verify caller is a platform admin
        let is_admin: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND role = 'admin')"
        )
        .bind(admin_user_id)
        .fetch_one(&self.pool)
        .await?;

        if !is_admin {
            return Err(ServiceError::Forbidden);
        }

        let profession_id: Option<i64> = if let Some(prof) = &req.profession {
            let id: Option<i64> = sqlx::query_scalar(
                "SELECT id FROM professions WHERE name = $1"
            )
            .bind(prof)
            .fetch_optional(&self.pool)
            .await?;
            Some(id.ok_or(ServiceError::NotFound)?)
        } else {
            None
        };

        sqlx::query(
            r#"
            INSERT INTO valueskin_pricing
                (profession_id, tier, price_credits, price_usd_cents, updated_by_user_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (profession_id, tier) DO UPDATE SET
                price_credits = EXCLUDED.price_credits,
                price_usd_cents = EXCLUDED.price_usd_cents,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = NOW()
            "#
        )
        .bind(profession_id)
        .bind(&req.tier)
        .bind(req.price_credits)
        .bind(req.price_usd_cents)
        .bind(admin_user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_pricing(
        &self,
        _profession: Option<String>,
    ) -> Result<Vec<PricingResponse>, ServiceError> {
        let prices = sqlx::query_as::<_, ValueskinPricing>(
            "SELECT * FROM valueskin_pricing WHERE is_active = TRUE ORDER BY tier"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(prices
            .into_iter()
            .map(|p| PricingResponse {
                tier: p.tier.clone(),
                price_credits: p.price_credits,
                price_usd_cents: p.price_usd_cents,
                description: if p.tier == "community" {
                    "Join communities only".to_string()
                } else {
                    "Communities + brand marketplace".to_string()
                },
            })
            .collect())
    }

    // ── Private Helpers ────────────────────────────────────────────────

    async fn check_eligibility(
        &self,
        user_id: i64,
        comm: &Community,
    ) -> Result<(bool, Option<String>), ServiceError> {
        // Get user's ValueSkins
        let user_skins: Vec<(String, String)> = sqlx::query_as(
            "SELECT profession, tier FROM user_valueskin_tiers WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Check if user has any ValueSkin
        if user_skins.is_empty() {
            return Ok((
                false,
                Some("You need at least one ValueSkin to join communities".to_string()),
            ));
        }

        // Check gate type
        let eligible = if comm.gate_type == "any_valueskin" {
            // User needs ANY ValueSkin at required tier or higher
            user_skins
                .iter()
                .any(|(_, tier)| self.tier_satisfies(tier, &comm.required_tier))
        } else {
            // User needs a specific profession at required tier
            let gates: Vec<String> = sqlx::query_scalar(
                "SELECT profession FROM community_gates WHERE community_id = $1"
            )
            .bind(comm.id)
            .fetch_all(&self.pool)
            .await?;

            user_skins.iter().any(|(prof, tier)| {
                gates.contains(prof) && self.tier_satisfies(tier, &comm.required_tier)
            })
        };

        let reason = if !eligible {
            if comm.gate_type == "specific" {
                Some(format!(
                    "Requires one of these ValueSkins: {}",
                    sqlx::query_scalar::<_, String>(
                        "SELECT profession FROM community_gates WHERE community_id = $1"
                    )
                    .bind(comm.id)
                    .fetch_optional(&self.pool)
                    .await?
                    .unwrap_or_default()
                ))
            } else {
                Some(format!(
                    "Requires {} tier ValueSkin",
                    comm.required_tier
                ))
            }
        } else {
            None
        };

        Ok((eligible, reason))
    }

    fn tier_satisfies(&self, user_tier: &str, required_tier: &str) -> bool {
        if required_tier == "community" {
            user_tier == "community" || user_tier == "marketplace"
        } else {
            user_tier == "marketplace"
        }
    }
}
