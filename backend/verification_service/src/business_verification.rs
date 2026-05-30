//! Business Verification
//!
//! Verifies business registration documents and tax IDs.
//! Supports international formats: EIN (US), VAT (EU), GST (India), ABN (Australia).
//! Integration with D&B, OpenCorporates, and other business databases.

use crate::models::{Company, VerificationError};
use sqlx::PgPool;
use sha2::{Digest, Sha256};

pub struct BusinessVerificationService {
    pool: PgPool,
}

impl BusinessVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Submit business registration for verification
    pub async fn submit_registration(
        &self,
        company_id: i64,
        tax_id: &str,
        tax_id_country: &str,
        tax_id_type: &str,
        registration_number: &str,
        registration_country: &str,
        document_id: i64,
    ) -> Result<Company, VerificationError> {
        let tax_id_hash = hex::encode(Sha256::digest(tax_id.as_bytes()));

        // Validate tax ID format
        Self::validate_tax_id(tax_id, tax_id_country, tax_id_type)?;

        // Check if this tax ID is already associated with another company
        let duplicate: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM companies WHERE tax_id_sha256 = $1 AND id != $2)",
        )
        .bind(&tax_id_hash)
        .bind(company_id)
        .fetch_one(&self.pool)
        .await?;

        if duplicate {
            return Err(VerificationError::Forbidden(
                "Tax ID already registered to another company".to_string(),
            ));
        }

        sqlx::query(
            "UPDATE companies 
             SET tax_id_sha256 = $2, tax_id_country = $3, tax_id_type = $4,
                 registration_number = $5, registration_country = $6,
                 company_state = 'BUSINESS_REGISTRATION_SUBMITTED', updated_at = NOW()
             WHERE id = $1",
        )
        .bind(company_id)
        .bind(&tax_id_hash)
        .bind(tax_id_country)
        .bind(tax_id_type)
        .bind(registration_number)
        .bind(registration_country)
        .execute(&self.pool)
        .await?;

        // Auto-verify (in production: check against government databases)
        self.verify_registration(company_id).await
    }

    /// Verify registration (placeholder for government DB integration)
    async fn verify_registration(&self, company_id: i64) -> Result<Company, VerificationError> {
        // In production: call government API, D&B, OpenCorporates, etc.
        // For now, auto-advance to verified state
        sqlx::query(
            "UPDATE companies 
             SET company_state = 'BUSINESS_REGISTRATION_VERIFIED', verified_at = NOW(), 
                 verification_expires_at = NOW() + INTERVAL '1 year', updated_at = NOW()
             WHERE id = $1 AND company_state = 'BUSINESS_REGISTRATION_SUBMITTED'",
        )
        .bind(company_id)
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

    /// Validate tax ID format by country
    fn validate_tax_id(
        tax_id: &str,
        country: &str,
        tax_type: &str,
    ) -> Result<(), VerificationError> {
        match (country, tax_type) {
            ("US", "EIN") => {
                // Format: XX-XXXXXXX or XXXXXXXXX
                let cleaned = tax_id.replace('-', "");
                if cleaned.len() != 9 || !cleaned.chars().all(|c| c.is_ascii_digit()) {
                    return Err(VerificationError::DomainVerificationFailed(
                        "Invalid US EIN format".to_string(),
                    ));
                }
            }
            ("GB", "VAT") => {
                // Format: GB XXXXXXXXXX
                let cleaned = tax_id.replace(' ', "");
                if !cleaned.starts_with("GB") || cleaned.len() != 11 {
                    return Err(VerificationError::DomainVerificationFailed(
                        "Invalid UK VAT format".to_string(),
                    ));
                }
            }
            ("IN", "GST") => {
                // Format: 15 characters: 2 state + 10 PAN + 1 entity + 3
                if tax_id.len() != 15 {
                    return Err(VerificationError::DomainVerificationFailed(
                        "Invalid Indian GST format".to_string(),
                    ));
                }
            }
            ("AU", "ABN") => {
                // Format: 11 digits
                let cleaned = tax_id.replace(' ', "");
                if cleaned.len() != 11 || !cleaned.chars().all(|c| c.is_ascii_digit()) {
                    return Err(VerificationError::DomainVerificationFailed(
                        "Invalid Australian ABN format".to_string(),
                    ));
                }
            }
            ("DE", "VAT") => {
                // Format: DE XXXXXXXXX
                let cleaned = tax_id.replace(' ', "");
                if !cleaned.starts_with("DE") || cleaned.len() != 11 {
                    return Err(VerificationError::DomainVerificationFailed(
                        "Invalid German VAT format".to_string(),
                    ));
                }
            }
            _ => {
                // Unknown format — allow but flag
                tracing::warn!(country, tax_type, "Unknown tax ID format — manual review suggested");
            }
        }

        Ok(())
    }

    /// Check for known company names (brand protection)
    pub async fn check_company_name_conflict(
        &self,
        legal_name: &str,
        domain: &str,
    ) -> Result<Vec<String>, VerificationError> {
        // Check for exact name matches
        let exact: Vec<String> = sqlx::query_scalar(
            "SELECT legal_name FROM companies WHERE LOWER(legal_name) = LOWER($1) AND company_state NOT IN ('UNVERIFIED', 'VERIFICATION_REVOKED', 'BLACKLISTED')",
        )
        .bind(legal_name)
        .fetch_all(&self.pool)
        .await?;

        // Check for domain similarity with verified companies
        let verified_domains: Vec<String> = sqlx::query_scalar(
            "SELECT domain_name FROM companies 
             WHERE domain_name IS NOT NULL 
             AND company_state IN ('BUSINESS_VERIFIED', 'ENTERPRISE_VERIFIED')
             AND domain_name != $1",
        )
        .bind(domain)
        .fetch_all(&self.pool)
        .await?;

        let mut conflicts = Vec::new();

        if !exact.is_empty() {
            conflicts.push(format!("Company name '{}' already registered", legal_name));
        }

        for verified_domain in &verified_domains {
            if crate::domain_verification::DomainVerificationService::check_impersonation_domain(
                domain,
                verified_domain,
            ) {
                conflicts.push(format!(
                    "Domain '{}' appears to impersonate '{}'",
                    domain, verified_domain
                ));
            }
        }

        Ok(conflicts)
    }
}
