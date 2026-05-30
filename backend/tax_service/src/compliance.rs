//! Tax compliance helpers
//! W-9, W-8BEN, international tax handling, withholding calculations, GDPR/CCPA

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxIdentification {
    pub creator_id: String,
    pub entity_type: String,        // "individual", "business"
    pub tax_id: String,             // SSN or EIN
    pub tax_id_type: String,        // "ssn" or "ein"
    pub verified: bool,
}

pub struct TaxCompliance;

impl TaxCompliance {
    /// Check if creator needs W-9 on file (>$600 earnings)
    pub fn needs_w9(annual_earnings: i32) -> bool {
        annual_earnings >= 60000  // $600.00
    }

    /// Calculate federal withholding
    /// Simplified: 10% for non-verified, 0% for verified TINs
    pub fn calculate_federal_withholding(
        gross_amount: i32,
        tax_id_verified: bool,
    ) -> i32 {
        if tax_id_verified {
            0
        } else {
            (gross_amount as f32 * 0.10) as i32
        }
    }

    /// Calculate state withholding (varies by state)
    pub fn calculate_state_withholding(
        gross_amount: i32,
        state_code: &str,
    ) -> i32 {
        match state_code {
            "CA" => (gross_amount as f32 * 0.093) as i32,
            "NY" => (gross_amount as f32 * 0.062) as i32,
            "TX" => 0, // No state income tax
            _ => 0,
        }
    }

    /// Validate US tax ID format
    pub fn validate_ssn(ssn: &str) -> bool {
        let digits: String = ssn.chars().filter(|c| c.is_numeric()).collect();
        if digits.len() != 9 {
            return false;
        }
        // Basic validation: no all zeros/ones
        digits != "000000000" && digits != "111111111"
    }

    /// Validate EIN format
    pub fn validate_ein(ein: &str) -> bool {
        let digits: String = ein.chars().filter(|c| c.is_numeric()).collect();
        digits.len() == 9
    }

    /// Get tax form requirement (1099-NEC, 1099-MISC, etc.)
    pub fn get_tax_form_type(entity_type: &str) -> String {
        match entity_type {
            "individual" => "1099-NEC".to_string(),
            "business" | "llc" | "corp" => "1099-MISC".to_string(),
            _ => "1099-NEC".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssn_validation() {
        assert!(TaxCompliance::validate_ssn("123-45-6789"));
        assert!(TaxCompliance::validate_ssn("123456789"));
        assert!(!TaxCompliance::validate_ssn("000-00-0000"));
        assert!(!TaxCompliance::validate_ssn("12345")); // Too short
    }

    #[test]
    fn test_withholding_calculation() {
        assert_eq!(TaxCompliance::calculate_federal_withholding(100000, true), 0);
        assert_eq!(TaxCompliance::calculate_federal_withholding(100000, false), 10000);
    }

    #[test]
    fn test_w9_requirement() {
        assert!(!TaxCompliance::needs_w9(50000));
        assert!(TaxCompliance::needs_w9(60000));
        assert!(TaxCompliance::needs_w9(100000));
    }
}

/// International tax requirements and compliance framework
pub struct InternationalComplianceFramework;

impl InternationalComplianceFramework {
    /// Get tax requirements by country
    pub fn get_tax_requirements(country: &str) -> TaxRequirement {
        match country.to_uppercase().as_str() {
            "US" => TaxRequirement {
                country: "US".to_string(),
                form_required: "1099-NEC (>$600)".to_string(),
                withholding_rate: 0.0,
                treaty_countries: vec!["CA".to_string(), "GB".to_string(), "IN".to_string(), "AU".to_string()],
                filing_deadline: "2025-01-31".to_string(),
                requirements: vec![
                    "SSN or ITIN required".to_string(),
                    "W-9 or W-8BEN on file".to_string(),
                    "1099-NEC if earnings > $600".to_string(),
                ],
            },
            "IN" => TaxRequirement {
                country: "IN".to_string(),
                form_required: "Form 15G/15H (TDS exempt)".to_string(),
                withholding_rate: 0.10,
                treaty_countries: vec!["US".to_string()],
                filing_deadline: "2025-05-31".to_string(),
                requirements: vec![
                    "PAN (Permanent Account Number) required".to_string(),
                    "TDS (Tax Deducted at Source) @ 10%".to_string(),
                    "Form 15G exempt if income < ₹50K".to_string(),
                    "Treaty benefit allows 0% withholding for services (US-India treaty)".to_string(),
                ],
            },
            "GB" => TaxRequirement {
                country: "GB".to_string(),
                form_required: "Self Assessment (£10K+)".to_string(),
                withholding_rate: 0.20,
                treaty_countries: vec!["US".to_string()],
                filing_deadline: "2025-01-31".to_string(),
                requirements: vec![
                    "NI Number required".to_string(),
                    "HMRC registration if £1K+ earnings".to_string(),
                    "VAT if turnover > £85K".to_string(),
                ],
            },
            "CA" => TaxRequirement {
                country: "CA".to_string(),
                form_required: "T4A / T1 General".to_string(),
                withholding_rate: 0.15,
                treaty_countries: vec!["US".to_string()],
                filing_deadline: "2025-06-15".to_string(),
                requirements: vec![
                    "SIN (Social Insurance Number)".to_string(),
                    "T4A form for payees".to_string(),
                    "All freelance income reportable".to_string(),
                ],
            },
            "AU" => TaxRequirement {
                country: "AU".to_string(),
                form_required: "Tax Return (>AUD 18.2K)".to_string(),
                withholding_rate: 0.10,
                treaty_countries: vec!["US".to_string()],
                filing_deadline: "2025-10-31".to_string(),
                requirements: vec![
                    "TFN (Tax File Number)".to_string(),
                    "ABN if business entity".to_string(),
                ],
            },
            _ => TaxRequirement {
                country: country.to_string(),
                form_required: "FATCA (Foreign Account Tax Compliance Act)".to_string(),
                withholding_rate: 0.30,
                treaty_countries: vec![],
                filing_deadline: "varies".to_string(),
                requirements: vec![
                    "FATCA W-8BEN (foreign person)".to_string(),
                    "30% default withholding for unknown jurisdictions".to_string(),
                ],
            },
        }
    }

    /// Get privacy/data compliance requirements
    pub fn get_privacy_requirements(country: &str) -> PrivacyRequirement {
        match country.to_uppercase().as_str() {
            c if c.starts_with("EU") || c == "GB" => PrivacyRequirement {
                jurisdiction: country.to_string(),
                regulations: vec!["GDPR".to_string()],
                requires_dpa: true,
                requires_consent: true,
                right_to_access: true,
                right_to_deletion: true,
                right_to_portability: true,
                data_retention_months: 12,
                description: "GDPR: Strict privacy rights (Access, Rectification, Erasure, Portability, Objection)".to_string(),
            },
            "US" => PrivacyRequirement {
                jurisdiction: "US".to_string(),
                regulations: vec!["CCPA".to_string(), "FTC Act 5(a)".to_string()],
                requires_dpa: false,
                requires_consent: true,
                right_to_access: true,
                right_to_deletion: true,
                right_to_portability: true,
                data_retention_months: 12,
                description: "CCPA: California residents have right to know, delete, opt-out (>$1 million revenue)".to_string(),
            },
            "IN" => PrivacyRequirement {
                jurisdiction: "IN".to_string(),
                regulations: vec!["India Stack Privacy Bill (proposed)".to_string()],
                requires_dpa: false,
                requires_consent: true,
                right_to_access: true,
                right_to_deletion: true,
                right_to_portability: false,
                data_retention_months: 60,
                description: "India: No comprehensive privacy law yet; MEITY guidelines apply. Data localization not mandated (unlike China).".to_string(),
            },
            "CN" => PrivacyRequirement {
                jurisdiction: "CN".to_string(),
                regulations: vec!["PIPL (Personal Information Protection Law)".to_string()],
                requires_dpa: true,
                requires_consent: true,
                right_to_access: true,
                right_to_deletion: true,
                right_to_portability: false,
                data_retention_months: 12,
                description: "PIPL: Requires data localization in China. Strict government access rights.".to_string(),
            },
            "BR" => PrivacyRequirement {
                jurisdiction: "BR".to_string(),
                regulations: vec!["LGPD (Lei Geral de Proteção de Dados)".to_string()],
                requires_dpa: true,
                requires_consent: true,
                right_to_access: true,
                right_to_deletion: true,
                right_to_portability: true,
                data_retention_months: 12,
                description: "LGPD: Brazil's GDPR-equivalent. Similar rights and requirements.".to_string(),
            },
            _ => PrivacyRequirement {
                jurisdiction: country.to_string(),
                regulations: vec!["Standard".to_string()],
                requires_dpa: false,
                requires_consent: true,
                right_to_access: false,
                right_to_deletion: false,
                right_to_portability: false,
                data_retention_months: 36,
                description: "Standard privacy practices apply".to_string(),
            },
        }
    }

    /// Determine withholding tax for creator payment
    pub fn calculate_withholding(
        country: &str,
        amount_cents: i64,
        is_treaty_beneficiary: bool,
    ) -> i64 {
        let rate = if is_treaty_beneficiary {
            match country.to_uppercase().as_str() {
                "IN" => 0.0, // US-India treaty: 0% for services
                "GB" => 0.0, // US-UK treaty: 0% for services
                "CA" => 0.0, // US-Canada treaty: 0% for services
                "AU" => 0.0, // US-Australia treaty: 0% for services
                _ => 0.15,
            }
        } else {
            match country.to_uppercase().as_str() {
                "US" => 0.0,
                "IN" => 0.10,
                "GB" => 0.20,
                "CA" => 0.15,
                "AU" => 0.10,
                _ => 0.30, // Default FATCA rate
            }
        };

        ((amount_cents as f64) * rate) as i64
    }

    /// Check if creator can receive payment (compliance check)
    pub fn can_receive_payment(
        country: &str,
        tax_id_verified: bool,
        required_forms_filed: bool,
        no_violations: bool,
    ) -> bool {
        tax_id_verified && required_forms_filed && no_violations
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxRequirement {
    pub country: String,
    pub form_required: String,
    pub withholding_rate: f64,
    pub treaty_countries: Vec<String>,
    pub filing_deadline: String,
    pub requirements: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyRequirement {
    pub jurisdiction: String,
    pub regulations: Vec<String>,
    pub requires_dpa: bool,
    pub requires_consent: bool,
    pub right_to_access: bool,
    pub right_to_deletion: bool,
    pub right_to_portability: bool,
    pub data_retention_months: i32,
    pub description: String,
}
