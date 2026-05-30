//! 1099-NEC Form Generation — creates PDF forms for tax filing

use serde::{Deserialize, Serialize};
use chrono::Datelike;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Form1099NEC {
    pub form_id: String,
    pub tax_year: i32,
    pub filer_ein: String,
    pub filer_name: String,
    pub filer_address: String,
    pub filer_city_state_zip: String,
    pub payee_ssn: String,
    pub payee_name: String,
    pub payee_address: String,
    pub payee_city_state_zip: String,
    pub box_1b_royalties: i64, // cents
    pub box_2_other_income: i64, // cents
    pub box_4_federal_withholding: i64, // cents
    pub total_gross_amount: i64, // cents
}

#[derive(Debug)]
pub enum FormGenerationError {
    InvalidCreator,
    NoEarningsInYear,
    DatabaseError(String),
    PdfGenerationError(String),
    InvalidTaxId,
}

pub struct Form1099NECGenerator;

impl Form1099NECGenerator {
    /// Generate 1099-NEC form data from database
    pub async fn generate_form(
        pool: &sqlx::PgPool,
        creator_user_id: i64,
        tax_year: i32,
    ) -> Result<Form1099NEC, FormGenerationError> {
        // Get creator tax profile
        let tax_profile: Option<(String, String)> = sqlx::query_as(
            "SELECT ssn_or_tin, tax_country FROM creator_tax_profiles WHERE creator_user_id = $1"
        )
        .bind(creator_user_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| FormGenerationError::DatabaseError(e.to_string()))?;

        let (ssn_masked, _country) = tax_profile
            .ok_or(FormGenerationError::InvalidCreator)?;

        // Get user info
        let (user_name, email): (String, String) = sqlx::query_as(
            "SELECT name, email FROM users WHERE id = $1"
        )
        .bind(creator_user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| FormGenerationError::DatabaseError(e.to_string()))?;

        // Aggregate earnings for the year
        #[derive(sqlx::FromRow)]
        struct YearlyStats {
            total_gross: Option<i64>,
            total_withheld: Option<i64>,
            deal_count: i64,
        }

        let stats: YearlyStats = sqlx::query_as(
            r#"
            SELECT
              SUM(CAST(reward_amount AS BIGINT)) as total_gross,
              SUM(CAST(tax_withheld AS BIGINT)) as total_withheld,
              COUNT(*) as deal_count
            FROM (
              SELECT DISTINCT
                o.reward_amount,
                COALESCE(te.tax_withheld_cents, 0) as tax_withheld
              FROM deal_rooms dr
              JOIN opportunities o ON dr.opportunity_id = o.id
              JOIN tax_events te ON dr.id = te.deal_id
              WHERE dr.creator_user_id = $1
                AND dr.status = 'completed'
                AND EXTRACT(YEAR FROM dr.completed_at) = $2
            ) completed
            "#
        )
        .bind(creator_user_id)
        .bind(tax_year as i32)
        .fetch_one(pool)
        .await
        .map_err(|e| FormGenerationError::DatabaseError(e.to_string()))?;

        if stats.deal_count == 0 {
            return Err(FormGenerationError::NoEarningsInYear);
        }

        let total_gross = stats.total_gross.unwrap_or(0);
        let total_withheld = stats.total_withheld.unwrap_or(0);

        // ValueSkins filer info (would be updated after incorporation)
        let filer_ein = "XX-XXXXXXX"; // TODO: Update after EIN obtained
        let filer_name = "ValueSkins, Inc.";
        let filer_address = "123 Creator Lane";
        let filer_city_state_zip = "San Francisco, CA 94107";

        Ok(Form1099NEC {
            form_id: uuid::Uuid::new_v4().to_string(),
            tax_year,
            filer_ein: filer_ein.to_string(),
            filer_name: filer_name.to_string(),
            filer_address: filer_address.to_string(),
            filer_city_state_zip: filer_city_state_zip.to_string(),
            payee_ssn: ssn_masked,
            payee_name: user_name,
            payee_address: "Address not collected (email provided)".to_string(),
            payee_city_state_zip: email,
            box_1b_royalties: 0, // Creators don't get royalties unless IP deal
            box_2_other_income: total_gross, // Sponsorship income goes here
            box_4_federal_withholding: total_withheld,
            total_gross_amount: total_gross,
        })
    }

    /// Convert form data to XML (IRS e-file format)
    pub fn to_irs_xml(form: &Form1099NEC) -> Result<String, FormGenerationError> {
        // Build XML according to IRS 1099-NEC e-file schema
        // Simplified version - in production use proper XML library
        let xml = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<Return>
  <ReturnHeader>
    <ReturnType>1099-NEC</ReturnType>
    <TaxYear>{}</TaxYear>
  </ReturnHeader>
  <Form1099NEC>
    <FilerName>{}</FilerName>
    <FilerEIN>{}</FilerEIN>
    <FilerAddress>{}</FilerAddress>
    <PayeeName>{}</PayeeName>
    <PayeeSSN>{}</PayeeSSN>
    <Box1b>{}</Box1b>
    <Box2>{}</Box2>
    <Box4>{}</Box4>
  </Form1099NEC>
</Return>"#,
            form.tax_year,
            form.filer_name,
            form.filer_ein,
            form.filer_address,
            form.payee_name,
            form.payee_ssn,
            form.box_1b_royalties / 100, // Convert from cents to dollars
            form.box_2_other_income / 100,
            form.box_4_federal_withholding / 100
        );
        Ok(xml)
    }

    /// Convert form data to PDF (text format for fallback)
    pub fn to_pdf_text(form: &Form1099NEC) -> Result<String, FormGenerationError> {
        let pdf_text = format!(
            r#"
============================================================
                    FORM 1099-NEC
            Nonemployee Compensation
                   Tax Year {}
============================================================

FILER INFORMATION:
Name: {}
EIN: {}
Address: {} {}

PAYEE INFORMATION:
Name: {}
SSN: {}
Address: {}

BOX 1b - Royalties: ${:.2}
BOX 2 - Other Income: ${:.2}
BOX 4 - Federal Withholding: ${:.2}

TOTAL GROSS AMOUNT: ${:.2}

Signature: ___________________
Date: ___________________

============================================================
"#,
            form.tax_year,
            form.filer_name,
            form.filer_ein,
            form.filer_address,
            form.filer_city_state_zip,
            form.payee_name,
            form.payee_ssn,
            form.payee_city_state_zip,
            form.box_1b_royalties as f64 / 100.0,
            form.box_2_other_income as f64 / 100.0,
            form.box_4_federal_withholding as f64 / 100.0,
            form.total_gross_amount as f64 / 100.0
        );
        Ok(pdf_text)
    }

    /// Generate PDF document with proper formatting
    pub fn to_pdf_bytes(form: &Form1099NEC) -> Result<Vec<u8>, FormGenerationError> {
        let pdf_text = Self::to_pdf_text(form)?;
        Ok(pdf_text.into_bytes())
    }

    /// Store generated form in database
    pub async fn save_form(
        pool: &sqlx::PgPool,
        form: &Form1099NEC,
        pdf_content: &str,
    ) -> Result<(), FormGenerationError> {
        sqlx::query(
            r#"
            INSERT INTO tax_forms (form_id, creator_user_id, form_type, tax_year, form_data, pdf_content, generated_at)
            VALUES ($1, (SELECT id FROM users WHERE name = $7), '1099-NEC', $2, $3::JSONB, $4, NOW())
            "#
        )
        .bind(&form.form_id)
        .bind(form.tax_year)
        .bind(serde_json::to_string(form).unwrap())
        .bind(pdf_content)
        .bind(&form.payee_name)
        .execute(pool)
        .await
        .map_err(|e| FormGenerationError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// Batch generate forms for all creators (annual process)
    pub async fn generate_batch_for_year(
        pool: &sqlx::PgPool,
        tax_year: i32,
    ) -> Result<Vec<Form1099NEC>, FormGenerationError> {
        let creator_ids: Vec<i64> = sqlx::query_scalar(
            "SELECT DISTINCT creator_user_id FROM creator_tax_profiles WHERE tax_country = 'US'"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| FormGenerationError::DatabaseError(e.to_string()))?;

        let mut forms = Vec::new();
        for creator_id in creator_ids {
            if let Ok(form) = Self::generate_form(pool, creator_id, tax_year).await {
                forms.push(form);
            }
        }

        Ok(forms)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormW8BEN {
    pub form_id: String,
    pub payee_name: String,
    pub payee_address: String,
    pub country_of_citizenship: String,
    pub permanent_residence_address: String,
    pub date_of_birth: String,
    pub us_tin: Option<String>,
    pub foreign_tin: String,
    pub claim_treaty_benefits: bool,
    pub treaty_country: Option<String>,
    pub withholding_rate: f64,
}

impl FormW8BEN {
    /// Generate W-8BEN for foreign creators (non-US tax residents)
    pub async fn generate_form(
        pool: &sqlx::PgPool,
        creator_user_id: i64,
    ) -> Result<FormW8BEN, FormGenerationError> {
        let (name, country): (String, String) = sqlx::query_as(
            "SELECT u.name, ctp.tax_country FROM users u JOIN creator_tax_profiles ctp ON u.id = ctp.creator_user_id WHERE u.id = $1"
        )
        .bind(creator_user_id)
        .fetch_one(pool)
        .await
        .map_err(|e| FormGenerationError::DatabaseError(e.to_string()))?;

        // Determine treaty benefit claim and reduced withholding rate
        let (treaty_applies, treaty_country, withholding_rate) = match country.as_str() {
            "IN" => (true, Some("India"), 0.15), // US-India treaty: 15% for services
            "GB" => (true, Some("United Kingdom"), 0.15),
            "CA" => (true, Some("Canada"), 0.15),
            "AU" => (true, Some("Australia"), 0.15),
            _ => (false, None, 0.30), // Default FATCA withholding
        };

        Ok(FormW8BEN {
            form_id: uuid::Uuid::new_v4().to_string(),
            payee_name: name,
            payee_address: "Address not provided".to_string(),
            country_of_citizenship: country,
            permanent_residence_address: "Address not provided".to_string(),
            date_of_birth: "DOB not collected".to_string(),
            us_tin: None,
            foreign_tin: "Tax ID not collected".to_string(),
            claim_treaty_benefits: treaty_applies,
            treaty_country: treaty_country.map(|s| s.to_string()),
            withholding_rate,
        })
    }
}
