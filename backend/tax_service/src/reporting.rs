//! Tax reporting and 1099-NEC generation
//! Required for creators earning >$600/year in the US

use serde::{Deserialize, Serialize};
use chrono::DateTime;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatorTaxReport {
    pub creator_id: String,
    pub creator_email: String,
    pub creator_name: String,
    pub tax_year: i32,
    pub total_earned: i32,      // USD cents
    pub total_paid_out: i32,    // USD cents
    pub withheld_amount: i32,   // USD cents
    pub needs_1099: bool,       // > $600
    pub form_1099_generated: bool,
    pub generated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Form1099NEC {
    pub creator_id: String,
    pub creator_tin: String,        // Tax ID (SSN/EIN)
    pub creator_name: String,
    pub creator_address: String,
    pub payer_name: String,         // ValueSkins Inc
    pub payer_tin: String,          // ValueSkins Tax ID
    pub box_1_income: i32,          // Non-employee compensation
    pub box_2_federal_withholding: i32,
    pub box_3_state_income: i32,
    pub box_4_state_withholding: i32,
    pub tax_year: i32,
    pub form_id: String,
}

pub struct TaxReporter {
    pool: sqlx::PgPool,
}

impl TaxReporter {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }

    /// Generate annual tax report for creator
    pub async fn generate_report(
        &self,
        creator_id: &str,
        tax_year: i32,
    ) -> Result<CreatorTaxReport, TaxError> {
        let creator_persona_id = creator_id
            .parse::<i64>()
            .map_err(|_| TaxError::InvalidCreatorId)?;

        // Query all completed deals for creator in tax year
        let earnings: (Option<i64>,) = sqlx::query_as(
            "SELECT SUM(CAST(total_amount * 100 AS BIGINT)) FROM completed_deals WHERE creator_persona_id = $1 AND EXTRACT(YEAR FROM completed_at) = $2"
        )
        .bind(creator_persona_id)
        .bind(tax_year as i32)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| TaxError::DatabaseError(e.to_string()))?;

        let total_earned = earnings.0.unwrap_or(0) as i32;
        let needs_1099 = total_earned >= 60000; // $600.00

        // Get creator info
        let creator: (String, String) = sqlx::query_as(
            "SELECT email, name FROM users u JOIN personas p ON u.id = p.user_id WHERE p.id = $1"
        )
        .bind(creator_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|_| TaxError::NotFound)?;

        let (email, name) = creator;

        Ok(CreatorTaxReport {
            creator_id: creator_id.to_string(),
            creator_email: email,
            creator_name: name,
            tax_year,
            total_earned,
            total_paid_out: total_earned, // Assuming 100% payout (no withholding yet)
            withheld_amount: 0,
            needs_1099,
            form_1099_generated: false,
            generated_at: None,
        })
    }

    /// Generate Form 1099-NEC (stubbed - requires actual form generation library)
    pub async fn generate_form_1099_nec(
        &self,
        report: CreatorTaxReport,
        creator_tin: String,
    ) -> Result<Form1099NEC, TaxError> {
        if !report.needs_1099 {
            return Err(TaxError::BelowThreshold);
        }

        let form = Form1099NEC {
            creator_id: report.creator_id,
            creator_tin,
            creator_name: report.creator_name,
            creator_address: "Address not collected".to_string(), // TODO: collect in KYC
            payer_name: "ValueSkins Inc".to_string(),
            payer_tin: "00-0000000".to_string(), // Placeholder
            box_1_income: report.total_earned,
            box_2_federal_withholding: 0,
            box_3_state_income: 0,
            box_4_state_withholding: 0,
            tax_year: report.tax_year,
            form_id: uuid::Uuid::new_v4().to_string(),
        };

        // In production: generate actual PDF form
        // For MVP: just create the record
        sqlx::query(
            "INSERT INTO form_1099_records (form_id, creator_id, tax_year, income_amount, created_at) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(&form.form_id)
        .bind(&form.creator_id)
        .bind(form.tax_year)
        .bind(form.box_1_income)
        .bind(Utc::now())
        .execute(&self.pool)
        .await
        .map_err(|e| TaxError::DatabaseError(e.to_string()))?;

        Ok(form)
    }
}

#[derive(Debug)]
pub enum TaxError {
    NotFound,
    BelowThreshold,
    InvalidCreatorId,
    DatabaseError(String),
    FormGenerationError(String),
}

impl std::fmt::Display for TaxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaxError::NotFound => write!(f, "Creator not found"),
            TaxError::BelowThreshold => write!(f, "Earnings below $600 threshold"),
            TaxError::InvalidCreatorId => write!(f, "Invalid creator id"),
            TaxError::DatabaseError(e) => write!(f, "Database error: {}", e),
            TaxError::FormGenerationError(e) => write!(f, "Form generation error: {}", e),
        }
    }
}

impl std::error::Error for TaxError {}
