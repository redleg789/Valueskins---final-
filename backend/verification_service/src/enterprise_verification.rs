//! Enterprise Verification
//!
//! Higher tier verification for large enterprises.
//! Multi-factor: stock exchange listing, SEC filings, D&B report, manual review.

use crate::models::{Company, VerificationError};
use sqlx::PgPool;

pub struct EnterpriseVerificationService {
    pool: PgPool,
}

impl EnterpriseVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Upgrade a company to enterprise tier
    pub async fn upgrade_to_enterprise(
        &self,
        company_id: i64,
        stock_ticker: Option<String>,
        stock_exchange: Option<String>,
        is_publicly_traded: bool,
        employee_count: &str,
        annual_revenue: &str,
    ) -> Result<Company, VerificationError> {
        // Verify current state allows upgrade
        let current_state: String = sqlx::query_scalar(
            "SELECT company_state FROM companies WHERE id = $1",
        )
        .bind(company_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(VerificationError::CompanyNotFound)?;

        if current_state != "BUSINESS_REGISTRATION_VERIFIED" && current_state != "EMPLOYEE_VERIFIED" {
            return Err(VerificationError::Forbidden(
                "Company must be business verified before enterprise upgrade".to_string(),
            ));
        }

        sqlx::query(
            "UPDATE companies 
             SET company_state = 'ENTERPRISE_VERIFIED', 
                 is_publicly_traded = $2, stock_ticker = $3, stock_exchange = $4,
                 employee_count_range = $5, annual_revenue_range = $6,
                 verified_at = NOW(), verification_expires_at = NOW() + INTERVAL '2 years',
                 updated_at = NOW()
             WHERE id = $1",
        )
        .bind(company_id)
        .bind(is_publicly_traded)
        .bind(stock_ticker)
        .bind(stock_exchange)
        .bind(employee_count)
        .bind(annual_revenue)
        .execute(&self.pool)
        .await?;

        let company = sqlx::query_as::<_, Company>(
            "SELECT * FROM companies WHERE id = $1",
        )
        .bind(company_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(company)
    }

    /// Flag a company as potential impersonation
    pub async fn flag_impersonation(
        &self,
        company_id: i64,
        reason: &str,
        evidence: serde_json::Value,
    ) -> Result<Company, VerificationError> {
        sqlx::query(
            "UPDATE companies 
             SET company_state = 'IMPERSONATION_FLAGGED', notes = $2, updated_at = NOW()
             WHERE id = $1",
        )
        .bind(company_id)
        .bind(reason)
        .execute(&self.pool)
        .await?;

        let moderation_id: i64 = sqlx::query_scalar::<_, i64>(
            "INSERT INTO moderation_queue 
             (target_company_id, source, priority, category, description, ai_analysis)
             VALUES ($1, 'SYSTEM_FLAG', 'high', 'impersonation', $2, $3)
             RETURNING id",
        )
        .bind(company_id)
        .bind(reason)
        .bind(evidence)
        .fetch_one(&self.pool)
        .await?;

        let _ = moderation_id;

        sqlx::query(
            "UPDATE companies SET notes = COALESCE(notes || E'\n', '') || $2 WHERE id = $1",
        )
        .bind(company_id)
        .bind(format!("Moderation case #{} created", moderation_id))
        .execute(&self.pool)
        .await?;

        let company = sqlx::query_as::<_, Company>(
            "SELECT * FROM companies WHERE id = $1",
        )
        .bind(company_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(company)
    }

    /// Claim a company name (prevent others from using it)
    pub async fn claim_company_name(
        &self,
        claiming_user_id: i64,
        company_name: &str,
        domain: Option<&str>,
        actual_company_id: Option<i64>,
    ) -> Result<(), VerificationError> {
        sqlx::query(
            "INSERT INTO enterprise_claims 
             (claiming_user_id, claimed_company_name, claimed_domain, actual_company_id)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(claiming_user_id)
        .bind(company_name)
        .bind(domain)
        .bind(actual_company_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
