use crate::business_verification::BusinessVerificationService;
use crate::domain_verification::DomainVerificationService;
use crate::enterprise_verification::EnterpriseVerificationService;
use crate::models::*;
use sha2::{Digest, Sha256};
use sqlx::PgPool;

pub struct VerificationService {
    pool: PgPool,
    domain_service: DomainVerificationService,
    business_service: BusinessVerificationService,
    enterprise_service: EnterpriseVerificationService,
}

impl VerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            domain_service: DomainVerificationService::new(pool.clone()),
            business_service: BusinessVerificationService::new(pool.clone()),
            enterprise_service: EnterpriseVerificationService::new(pool.clone()),
            pool,
        }
    }

    // ============================================================
    // Company Lifecycle
    // ============================================================

    /// Create a new company
    pub async fn create_company(
        &self,
        user_id: i64,
        req: &CreateCompanyRequest,
    ) -> Result<Company, VerificationError> {
        // Validate domain
        DomainVerificationService::validate_domain(&req.domain_name)?;

        // Check for name/domain conflicts
        let conflicts = self.business_service
            .check_company_name_conflict(&req.legal_name, &req.domain_name)
            .await?;

        if !conflicts.is_empty() {
            return Err(VerificationError::Forbidden(conflicts.join("; ")));
        }

        // Normalize domain
        let domain = req.domain_name.trim().to_lowercase();
        let domain = domain.trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_start_matches("www.")
            .to_string();

        let company = sqlx::query_as::<_, Company>(
            "INSERT INTO companies (legal_name, doing_business_as, website, domain_name, company_state)
             VALUES ($1, $2, $3, $4, 'DOMAIN_CLAIMED')
             RETURNING *",
        )
        .bind(&req.legal_name)
        .bind(&req.doing_business_as)
        .bind(&req.website)
        .bind(&domain)
        .fetch_one(&self.pool)
        .await?;

        // Log enterprise claim
        self.enterprise_service
            .claim_company_name(user_id, &req.legal_name, Some(&domain), Some(company.id))
            .await?;

        Ok(company)
    }

    /// Initiate domain verification
    pub async fn initiate_domain_verification(
        &self,
        company_id: i64,
        domain: &str,
    ) -> Result<String, VerificationError> {
        let (_, instructions) = self.domain_service.generate_token(company_id, domain).await?;
        Ok(instructions)
    }

    /// Verify domain via DNS
    pub async fn verify_domain(
        &self,
        company_id: i64,
        domain: &str,
        token: &str,
    ) -> Result<Company, VerificationError> {
        let verified = self.domain_service.verify_via_dns(company_id, domain, token).await?;

        if !verified {
            return Err(VerificationError::DomainVerificationFailed(
                "DNS verification failed — check that TXT record is properly configured".to_string(),
            ));
        }

        let company = sqlx::query_as::<_, Company>(
            "SELECT * FROM companies WHERE id = $1",
        )
        .bind(company_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(company)
    }

    // ============================================================
    // Employee Verification
    // ============================================================

    /// Initiate employee verification via work email
    pub async fn initiate_employee_verification(
        &self,
        user_id: i64,
        req: &InitiateEmployeeVerificationRequest,
    ) -> Result<EmployeeVerification, VerificationError> {
        // Extract domain from email
        let parts: Vec<&str> = req.work_email.split('@').collect();
        if parts.len() != 2 {
            return Err(VerificationError::DomainVerificationFailed("Invalid email".to_string()));
        }
        let email_domain = parts[1];

        // Verify domain matches company
        let company_domain: String = sqlx::query_scalar::<_, Option<String>>(
            "SELECT domain_name FROM companies WHERE id = $1",
        )
        .bind(req.company_id)
        .fetch_optional(&self.pool)
        .await?
        .flatten()
        .ok_or(VerificationError::CompanyNotFound)?;

        if email_domain != company_domain {
            return Err(VerificationError::DomainVerificationFailed(format!(
                "Email domain '{}' does not match company domain '{}'",
                email_domain, company_domain
            )));
        }

        let email_hash = hex::encode(Sha256::digest(req.work_email.as_bytes()));

        // Check if already verified
        let existing: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM employee_verifications 
             WHERE user_id = $1 AND company_id = $2 AND state IN ('FULLY_VERIFIED', 'DOMAIN_EMAIL_VERIFIED'))",
        )
        .bind(user_id)
        .bind(req.company_id)
        .fetch_one(&self.pool)
        .await?;

        if existing {
            return Err(VerificationError::Forbidden("Already verified at this company".to_string()));
        }

        let verification = sqlx::query_as::<_, EmployeeVerification>(
            "INSERT INTO employee_verifications 
             (user_id, company_id, state, work_email, work_email_sha256, 
              job_title, department, employment_type)
             VALUES ($1, $2, 'DOMAIN_EMAIL_SENT', $3, $4, $5, $6, $7)
             RETURNING *",
        )
        .bind(user_id)
        .bind(req.company_id)
        .bind(&req.work_email)
        .bind(&email_hash)
        .bind(&req.job_title)
        .bind(&req.department)
        .bind(&req.employment_type)
        .fetch_one(&self.pool)
        .await?;

        // In production: send verification email here
        tracing::info!(
            verification_id = verification.id,
            user_id,
            company_id = req.company_id,
            email = %req.work_email,
            "Employee verification email sent"
        );

        Ok(verification)
    }

    /// Complete employee verification (after email link clicked)
    pub async fn complete_employee_verification(
        &self,
        verification_id: i64,
        user_id: i64,
    ) -> Result<EmployeeVerification, VerificationError> {
        let verification = sqlx::query_as::<_, EmployeeVerification>(
            "SELECT * FROM employee_verifications WHERE id = $1 AND user_id = $2",
        )
        .bind(verification_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(VerificationError::EmployeeVerificationNotFound)?;

        if verification.state != "DOMAIN_EMAIL_SENT" {
            return Err(VerificationError::Forbidden(
                "Verification already completed or expired".to_string(),
            ));
        }

        let now = Utc::now();
        let expires_at = now + chrono::Duration::days(365);

        let updated = sqlx::query_as::<_, EmployeeVerification>(
            "UPDATE employee_verifications 
             SET state = 'FULLY_VERIFIED', work_email_verified_at = $2, 
                 verification_expires_at = $3, updated_at = NOW()
             WHERE id = $1 AND user_id = $4
             RETURNING *",
        )
        .bind(verification_id)
        .bind(now)
        .bind(expires_at)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Grant company role
        sqlx::query(
            "INSERT INTO company_roles (company_id, user_id, role_type, title)
             VALUES ($1, $2, 'EMPLOYEE', $3)
             ON CONFLICT (company_id, user_id, role_type, is_active) WHERE is_active = TRUE DO NOTHING",
        )
        .bind(verification.company_id)
        .bind(user_id)
        .bind(&verification.job_title)
        .execute(&self.pool)
        .await?;

        // Update company employee count
        sqlx::query(
            "UPDATE companies SET company_state = 'EMPLOYEE_VERIFIED', updated_at = NOW()
             WHERE id = $1 AND company_state IN ('DNS_VERIFIED', 'BUSINESS_REGISTRATION_VERIFIED')",
        )
        .bind(verification.company_id)
        .execute(&self.pool)
        .await?;

        Ok(updated)
    }

    /// Get company verification status
    pub async fn get_company_status(
        &self,
        company_id: i64,
    ) -> Result<CompanyVerificationStatusResponse, VerificationError> {
        let company = sqlx::query_as::<_, Company>(
            "SELECT * FROM companies WHERE id = $1",
        )
        .bind(company_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(VerificationError::CompanyNotFound)?;

        let employee_count: i32 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM employee_verifications 
             WHERE company_id = $1 AND state = 'FULLY_VERIFIED'",
        )
        .bind(company_id)
        .fetch_one(&self.pool)
        .await? as i32;

        let state = company.company_state.clone();
        Ok(CompanyVerificationStatusResponse {
            company_id: company.id,
            company_name: company.legal_name,
            company_state: company.company_state.clone(),
            domain_verified: state != "UNVERIFIED" && state != "DOMAIN_CLAIMED",
            registration_verified: matches!(
                state.as_str(),
                "BUSINESS_REGISTRATION_VERIFIED" | "EMPLOYEE_VERIFIED" | "ENTERPRISE_VERIFIED" | "GOVERNMENT_VERIFIED" | "STRATEGIC_PARTNER"
            ),
            employee_count,
            verification_tier: state,
        })
    }
}

use chrono::Utc;
