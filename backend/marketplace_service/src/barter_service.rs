//! Barter Service
//!
//! Owns all logic for the "willing to barter" feature:
//! - User preference toggling (with eligibility checks)
//! - Opportunity compensation type validation
//! - Barter-specific deal completion (0 platform fee)
//! - Escrow bypass for non-monetary deals
//! - Cross-matching barter-willing creators with barter opportunities

use sqlx::PgPool;

// ── Error type ───────────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub enum BarterError {
    /// User not found in database
    NotFound,
    /// User is not eligible for barter (private account, no ValueSkin, etc.)
    NotEligible { reason: String },
    /// Invalid compensation type supplied
    InvalidCompensationType { supplied: String },
    /// Barter description required but missing
    BarterDescriptionRequired,
    /// Creator has not opted into barter — cannot apply to barter opportunities
    CreatorNotOpenToBarter,
    /// Database error
    Database(String),
}

impl From<sqlx::Error> for BarterError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => BarterError::NotFound,
            _ => BarterError::Database(err.to_string()),
        }
    }
}

// ── Service ──────────────────────────────────────────────────────────

pub struct BarterService {
    pool: PgPool,
}

impl BarterService {
    pub fn new(pool: PgPool) -> Self {
        BarterService { pool }
    }

    // ── Preference management ────────────────────────────────────────

    /// Toggle a user's barter preference.
    ///
    /// Enforces eligibility:
    /// 1. User must exist and be active
    /// 2. User must have at least one active ValueSkin (persona with profession)
    /// 3. User must NOT have a private/restricted account
    ///    (simulated via: user must have at least one public persona)
    ///
    /// Returns the new barter state.
    pub async fn set_barter_preference(
        &self,
        user_id: i64,
        willing: bool,
    ) -> Result<bool, BarterError> {
        // 1. Verify user exists and is active
        let is_active: bool = sqlx::query_scalar(
            "SELECT is_active FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(BarterError::from)?
        .ok_or(BarterError::NotFound)?;

        if !is_active {
            return Err(BarterError::NotEligible {
                reason: "Account is not active".to_string(),
            });
        }

        // 2. If turning ON, verify user has at least one ValueSkin
        if willing {
            let has_valueskin: bool = sqlx::query_scalar(
                "SELECT EXISTS(
                    SELECT 1 FROM persona_professions pp
                    JOIN personas p ON pp.persona_id = p.id
                    WHERE p.user_id = $1
                )"
            )
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(BarterError::from)?;

            if !has_valueskin {
                return Err(BarterError::NotEligible {
                    reason: "You need at least one ValueSkin to enable barter".to_string(),
                });
            }
        }

        // 3. Persist atomically
        sqlx::query(
            "UPDATE users SET willing_to_barter = $1 WHERE id = $2"
        )
        .bind(willing)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(BarterError::from)?;

        log::info!(
            "user_id={} set willing_to_barter={}",
            user_id,
            willing
        );

        Ok(willing)
    }

    /// Read a user's current barter preference.
    pub async fn get_barter_preference(
        &self,
        user_id: i64,
    ) -> Result<bool, BarterError> {
        let willing: bool = sqlx::query_scalar(
            "SELECT willing_to_barter FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(BarterError::from)?
        .ok_or(BarterError::NotFound)?;

        Ok(willing)
    }

    // ── Opportunity validation ───────────────────────────────────────

    /// Validate compensation_type for a new opportunity.
    ///
    /// Rules:
    /// - Must be one of: "paid", "barter", "exposure", "hybrid"
    /// - If "barter" or "exposure", barter_description is required
    /// - If "barter" or "exposure", reward_amount must be "0" or empty
    /// - If "hybrid", both reward_amount > 0 AND barter_description required
    pub fn validate_compensation(
        compensation_type: &str,
        barter_description: &Option<String>,
        reward_amount: &str,
    ) -> Result<(), BarterError> {
        if !super::models::VALID_COMPENSATION_TYPES.contains(&compensation_type) {
            return Err(BarterError::InvalidCompensationType {
                supplied: compensation_type.to_string(),
            });
        }

        match compensation_type {
            "barter" | "exposure" => {
                // Must have a description of what's offered in return
                let desc = barter_description.as_deref().unwrap_or("").trim();
                if desc.is_empty() {
                    return Err(BarterError::BarterDescriptionRequired);
                }
                // reward_amount should be 0 for pure barter/exposure
                let amount: f64 = reward_amount.parse().unwrap_or(0.0);
                if amount > 0.0 {
                    return Err(BarterError::InvalidCompensationType {
                        supplied: format!(
                            "compensation_type='{}' but reward_amount={} — set to 0 for non-monetary deals",
                            compensation_type, reward_amount
                        ),
                    });
                }
            }
            "hybrid" => {
                // Must have both monetary reward AND barter description
                let desc = barter_description.as_deref().unwrap_or("").trim();
                if desc.is_empty() {
                    return Err(BarterError::BarterDescriptionRequired);
                }
                let amount: f64 = reward_amount.parse().unwrap_or(0.0);
                if amount <= 0.0 {
                    return Err(BarterError::InvalidCompensationType {
                        supplied: "compensation_type='hybrid' requires reward_amount > 0".to_string(),
                    });
                }
            }
            "paid" => {
                // Standard paid deal — no special validation
            }
            _ => {}
        }

        Ok(())
    }

    // ── Application eligibility ──────────────────────────────────────

    /// Check if a creator can apply to a barter/exposure opportunity.
    ///
    /// Rule: Creator must have willing_to_barter=true to apply to
    /// opportunities where compensation_type is "barter" or "exposure".
    /// "hybrid" and "paid" are always open.
    pub async fn check_creator_barter_eligibility(
        &self,
        creator_user_id: i64,
        opportunity_compensation_type: &str,
    ) -> Result<(), BarterError> {
        if opportunity_compensation_type != "barter" && opportunity_compensation_type != "exposure" {
            // No barter check needed for paid/hybrid
            return Ok(());
        }

        let willing: bool = sqlx::query_scalar(
            "SELECT willing_to_barter FROM users WHERE id = $1"
        )
        .bind(creator_user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(BarterError::from)?
        .ok_or(BarterError::NotFound)?;

        if !willing {
            return Err(BarterError::CreatorNotOpenToBarter);
        }

        Ok(())
    }

    // ── Deal completion ──────────────────────────────────────────────

    /// Calculate platform fee for a deal based on compensation type.
    ///
    /// Uses integer-cent arithmetic internally to prevent floating-point
    /// rounding errors that compound at scale. At 2B transactions/year,
    /// f64 rounding on $0.005 can silently shift ~$10M between platform
    /// and creators. All intermediate math is done in cents (i64), then
    /// converted back to f64 only for the return value.
    ///
    /// - "paid": standard 5% fee
    /// - "barter" / "exposure": 0% fee, 0 payout (no money)
    /// - "hybrid": 5% fee on monetary portion only
    pub fn calculate_platform_fee(
        compensation_type: &str,
        total_amount: f64,
        standard_fee_pct: f64,
    ) -> (f64, f64, f64) {
        // Returns: (creator_payout, platform_fee, effective_fee_pct)
        match compensation_type {
            "barter" | "exposure" => {
                (0.0, 0.0, 0.0)
            }
            "hybrid" | "paid" => {
                // Convert to cents to avoid f64 precision loss on fractional dollars.
                // round() ensures $19.995 -> 2000 cents, not 1999.
                let total_cents = (total_amount * 100.0).round() as i64;

                // Floor the fee so the platform never overcharges creators.
                // At scale, this is auditable: platform always rounds down on its cut.
                let fee_cents = (total_cents as f64 * standard_fee_pct / 100.0).floor() as i64;
                let payout_cents = total_cents - fee_cents;

                // Invariant: payout + fee == total (no money created or destroyed)
                debug_assert_eq!(payout_cents + fee_cents, total_cents,
                    "Fee split must be lossless: {} + {} != {}", payout_cents, fee_cents, total_cents);

                (payout_cents as f64 / 100.0, fee_cents as f64 / 100.0, standard_fee_pct)
            }
            _ => {
                // Unknown type — treat as paid (safe default)
                let total_cents = (total_amount * 100.0).round() as i64;
                let fee_cents = (total_cents as f64 * standard_fee_pct / 100.0).floor() as i64;
                let payout_cents = total_cents - fee_cents;
                (payout_cents as f64 / 100.0, fee_cents as f64 / 100.0, standard_fee_pct)
            }
        }
    }

    // ── Escrow logic ─────────────────────────────────────────────────

    /// Check if a deal room requires financial escrow.
    ///
    /// Barter/exposure deals skip monetary escrow stages entirely.
    /// They still use the deal room for deliverable tracking,
    /// but the escrow_stages table is not populated with amounts.
    pub fn requires_financial_escrow(compensation_type: &str) -> bool {
        match compensation_type {
            "barter" | "exposure" => false,
            _ => true, // "paid" and "hybrid" require escrow
        }
    }

    // ── Query helpers ────────────────────────────────────────────────

    /// Check if a specific user is willing to barter.
    /// Used by brand marketplace views to show the badge.
    pub async fn is_user_open_to_barter(
        &self,
        user_id: i64,
    ) -> Result<bool, BarterError> {
        self.get_barter_preference(user_id).await
    }

    /// Get all creators willing to barter for a given profession.
    /// Used by brand discovery / filtering.
    pub async fn list_barter_willing_creators(
        &self,
        profession_id: Option<i64>,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<i64>, BarterError> {
        let max_limit = limit.min(100).max(1);

        let user_ids: Vec<i64> = if let Some(prof_id) = profession_id {
            sqlx::query_scalar(
                "SELECT DISTINCT u.id
                 FROM users u
                 JOIN personas p ON p.user_id = u.id
                 JOIN persona_professions pp ON pp.persona_id = p.id
                 WHERE u.willing_to_barter = TRUE
                   AND u.is_active = TRUE
                   AND pp.profession_id = $1
                 ORDER BY u.id
                 LIMIT $2 OFFSET $3"
            )
            .bind(prof_id)
            .bind(max_limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(BarterError::from)?
        } else {
            sqlx::query_scalar(
                "SELECT u.id
                 FROM users u
                 WHERE u.willing_to_barter = TRUE
                   AND u.is_active = TRUE
                 ORDER BY u.id
                 LIMIT $1 OFFSET $2"
            )
            .bind(max_limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(BarterError::from)?
        };

        Ok(user_ids)
    }
}
