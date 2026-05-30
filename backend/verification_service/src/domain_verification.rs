//! Domain Verification
//!
//! Multiple methods to prove domain ownership:
//! 1. DNS TXT record verification
//! 2. DNS CNAME verification
//! 3. Email verification (admin@domain.com)
//! 4. Website file verification
//!
//! Prevents impersonation by requiring domain control proof.

use crate::models::VerificationError;
use sha2::{Digest, Sha256};
use sqlx::PgPool;

pub struct DomainVerificationService {
    pool: PgPool,
}

impl DomainVerificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Generate a verification token for a domain
    pub async fn generate_token(
        &self,
        company_id: i64,
        domain: &str,
    ) -> Result<(String, String), VerificationError> {
        let token = format!(
            "valueskins-verify={}:{}:{}",
            company_id,
            domain,
            uuid::Uuid::new_v4()
        );
        let token_hash = hex::encode(Sha256::digest(token.as_bytes()));

        // Check for existing active claim
        let existing: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM company_domain_claims 
             WHERE company_id = $1 AND domain_name = $2 AND is_active = TRUE)",
        )
        .bind(company_id)
        .bind(domain)
        .fetch_one(&self.pool)
        .await?;

        if existing {
            // Deactivate existing
            sqlx::query(
                "UPDATE company_domain_claims SET is_active = FALSE WHERE company_id = $1 AND domain_name = $2",
            )
            .bind(company_id)
            .bind(domain)
            .execute(&self.pool)
            .await?;
        }

        // Store claim
        sqlx::query(
            "INSERT INTO company_domain_claims 
             (company_id, domain_name, verification_method, verification_token, verification_token_sha256)
             VALUES ($1, $2, 'dns_txt', $3, $4)",
        )
        .bind(company_id)
        .bind(domain)
        .bind(&token)
        .bind(&token_hash)
        .execute(&self.pool)
        .await?;

        Ok((token.clone(), format!("Add this TXT record to your domain:\n\nName: {}\nType: TXT\nValue: {}", domain, token)))
    }

    /// Verify a domain by checking DNS TXT record
    pub async fn verify_via_dns(
        &self,
        company_id: i64,
        domain: &str,
        expected_token: &str,
    ) -> Result<bool, VerificationError> {
        let token_hash = hex::encode(Sha256::digest(expected_token.as_bytes()));

        // Real DNS TXT record verification via trust-dns-resolver
        let match_found = match Self::lookup_txt_record(domain, expected_token).await {
            Ok(found) => found,
            Err(e) => {
                tracing::warn!(domain, error = %e, "DNS lookup failed — recording attempt for retry");
                // DNS failure is not a verification failure; record attempt so user can retry
                sqlx::query(
                    "UPDATE company_domain_claims
                     SET verification_attempts = verification_attempts + 1, last_attempt_at = NOW()
                     WHERE company_id = $1 AND domain_name = $2",
                )
                .bind(company_id)
                .bind(domain)
                .execute(&self.pool)
                .await?;
                return Ok(false);
            }
        };

        if match_found {
            sqlx::query(
                "UPDATE company_domain_claims 
                 SET verified_at = NOW(), verification_attempts = verification_attempts + 1, is_active = TRUE
                 WHERE company_id = $1 AND domain_name = $2 AND verification_token_sha256 = $3",
            )
            .bind(company_id)
            .bind(domain)
            .bind(&token_hash)
            .execute(&self.pool)
            .await?;

            // Update company state
            sqlx::query(
                "UPDATE companies 
                 SET company_state = 'DNS_VERIFIED', domain_name = $2, updated_at = NOW()
                 WHERE id = $1 AND company_state IN ('UNVERIFIED', 'DOMAIN_CLAIMED')",
            )
            .bind(company_id)
            .bind(domain)
            .execute(&self.pool)
            .await?;

            Ok(true)
        } else {
            sqlx::query(
                "UPDATE company_domain_claims 
                 SET verification_attempts = verification_attempts + 1, last_attempt_at = NOW()
                 WHERE company_id = $1 AND domain_name = $2",
            )
            .bind(company_id)
            .bind(domain)
            .execute(&self.pool)
            .await?;

            Ok(false)
        }
    }

    /// Check domain for known impersonation patterns
    pub fn check_impersonation_domain(domain: &str, known_company_domain: &str) -> bool {
        if domain == known_company_domain {
            return false; // Exact match is legit
        }

        // Check for homograph attacks (replacing chars with look-alikes)
        let normalized = domain.to_lowercase();
        let known = known_company_domain.to_lowercase();

        // Levenshtein distance for typo detection
        let distance = levenshtein_distance(&normalized, &known);
        if distance <= 2 && distance > 0 {
            return true; // Typo-squatting
        }

        // Check for subdomain impersonation (e.g., google.com.evil.com)
        if normalized.contains(&known) && !normalized.ends_with(&known) {
            return true;
        }

        // Check for common replacements
        let replacements = [
            ("0", "o"), ("1", "l"), ("3", "e"), ("4", "a"),
            ("5", "s"), ("6", "g"), ("7", "t"), ("8", "b"),
        ];
        for (num, letter) in &replacements {
            if normalized.contains(num) && known.contains(letter) {
                let test = normalized.replace(num, letter);
                if test == known {
                    return true;
                }
            }
        }

        false
    }

    /// Perform real DNS TXT record lookup
    async fn lookup_txt_record(domain: &str, expected_token: &str) -> Result<bool, String> {
        use std::time::Duration;
        use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
        use trust_dns_resolver::TokioAsyncResolver;

        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_secs(10);
        opts.attempts = 2;

        let resolver = TokioAsyncResolver::tokio(
            ResolverConfig::default(),
            opts,
        );

        let lookup_domain = format!("{}.",
            domain.trim_end_matches('.')
        );

        match resolver.txt_lookup(&lookup_domain).await {
            Ok(response) => {
                let found = response.iter().any(|record| {
                    let txt = record.to_string().to_lowercase();
                    txt.contains(&expected_token.to_lowercase())
                });
                Ok(found)
            }
            Err(e) => Err(format!("DNS lookup error: {}", e)),
        }
    }

    /// Validate domain format and check for disposable domains
    pub fn validate_domain(domain: &str) -> Result<(), VerificationError> {
        if domain.len() > 255 {
            return Err(VerificationError::DomainVerificationFailed("Domain too long".to_string()));
        }

        if !domain.contains('.') {
            return Err(VerificationError::DomainVerificationFailed("Invalid domain format".to_string()));
        }

        // Check for known disposable email domains
        let disposable = ["mailinator.com", "tempmail.com", "10minutemail.com",
                          "guerrillamail.com", "yopmail.com", "throwaway.email"];
        if disposable.contains(&domain.to_lowercase().as_str()) {
            return Err(VerificationError::DomainVerificationFailed("Disposable domain not allowed".to_string()));
        }

        Ok(())
    }
}

/// Levenshtein distance for typo-squatting detection
fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let a_len = a_chars.len();
    let b_len = b_chars.len();

    let mut matrix = vec![vec![0usize; b_len + 1]; a_len + 1];

    for i in 0..=a_len {
        matrix[i][0] = i;
    }
    for j in 0..=b_len {
        matrix[0][j] = j;
    }

    for i in 1..=a_len {
        for j in 1..=b_len {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            matrix[i][j] = std::cmp::min(
                std::cmp::min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1),
                matrix[i - 1][j - 1] + cost,
            );
        }
    }

    matrix[a_len][b_len]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match_not_impersonation() {
        assert!(!DomainVerificationService::check_impersonation_domain("google.com", "google.com"));
    }

    #[test]
    fn test_typo_squatting_detected() {
        assert!(DomainVerificationService::check_impersonation_domain("gooogle.com", "google.com"));
        assert!(DomainVerificationService::check_impersonation_domain("googel.com", "google.com"));
    }

    #[test]
    fn test_homograph_detected() {
        assert!(DomainVerificationService::check_impersonation_domain("g00gle.com", "google.com"));
    }

    #[test]
    fn test_subdomain_impersonation() {
        assert!(DomainVerificationService::check_impersonation_domain("google.com.evil.com", "google.com"));
    }

    #[test]
    fn test_disposable_domain_rejected() {
        assert!(DomainVerificationService::validate_domain("mailinator.com").is_err());
        assert!(DomainVerificationService::validate_domain("google.com").is_ok());
    }

    #[test]
    fn test_levenshtein() {
        assert_eq!(levenshtein_distance("google", "gooogle"), 1);
        assert_eq!(levenshtein_distance("google", "g00gle"), 2);
        assert_eq!(levenshtein_distance("same", "same"), 0);
    }
}
