//! Stripe integration for payment processing
//! PCI-DSS scope zero: Stripe handles card tokenization

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentIntent {
    pub intent_id: String,
    pub client_secret: String,
    pub status: String,    // "requires_payment_method" | "succeeded" | "processing"
    pub amount_usd: i32,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentIntentRequest {
    pub deal_id: String,
    pub amount_usd: i32,
    pub description: String,
    pub metadata: std::collections::HashMap<String, String>,
}

pub struct StripeClient {
    api_key: String,
    http_client: reqwest::Client,
}

impl StripeClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            http_client: reqwest::Client::new(),
        }
    }

    /// Create payment intent (frontend will complete with card)
    pub async fn create_payment_intent(
        &self,
        req: PaymentIntentRequest,
    ) -> Result<PaymentIntent, StripeError> {
        let mut params = std::collections::HashMap::new();
        params.insert("amount".to_string(), (req.amount_usd * 100).to_string()); // Convert to cents
        params.insert("currency".to_string(), "usd".to_string());
        params.insert("description".to_string(), req.description);

        // Add metadata
        for (k, v) in req.metadata {
            params.insert(format!("metadata[{}]", k), v);
        }

        let response = self.http_client
            .post("https://api.stripe.com/v1/payment_intents")
            .basic_auth(&self.api_key, Some(""))
            .form(&params)
            .send()
            .await
            .map_err(|e| StripeError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(StripeError::APIError(format!(
                "Stripe error: {}",
                response.status()
            )));
        }

        let body: serde_json::Value = response.json().await
            .map_err(|e| StripeError::RequestError(e.to_string()))?;

        let intent_id = body["id"]
            .as_str()
            .ok_or_else(|| StripeError::InvalidResponse("missing id".to_string()))?
            .to_string();

        let client_secret = body["client_secret"]
            .as_str()
            .ok_or_else(|| StripeError::InvalidResponse("missing client_secret".to_string()))?
            .to_string();

        let status = body["status"]
            .as_str()
            .ok_or_else(|| StripeError::InvalidResponse("missing status".to_string()))?
            .to_string();

        Ok(PaymentIntent {
            intent_id,
            client_secret,
            status,
            amount_usd: req.amount_usd,
            currency: "usd".to_string(),
        })
    }

    /// Get payment intent status
    pub async fn get_payment_intent(&self, intent_id: &str) -> Result<PaymentIntent, StripeError> {
        let response = self.http_client
            .get(&format!("https://api.stripe.com/v1/payment_intents/{}", intent_id))
            .basic_auth(&self.api_key, Some(""))
            .send()
            .await
            .map_err(|e| StripeError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(StripeError::APIError(format!(
                "Stripe error: {}",
                response.status()
            )));
        }

        let body: serde_json::Value = response.json().await
            .map_err(|e| StripeError::RequestError(e.to_string()))?;

        let intent_id = body["id"]
            .as_str()
            .ok_or_else(|| StripeError::InvalidResponse("missing id".to_string()))?
            .to_string();

        let status = body["status"]
            .as_str()
            .ok_or_else(|| StripeError::InvalidResponse("missing status".to_string()))?
            .to_string();

        let amount = body["amount"]
            .as_i64()
            .unwrap_or(0) as i32 / 100; // Convert from cents

        Ok(PaymentIntent {
            intent_id,
            client_secret: String::new(),
            status,
            amount_usd: amount,
            currency: "usd".to_string(),
        })
    }

    /// Refund a payment
    pub async fn refund_payment(&self, intent_id: &str) -> Result<String, StripeError> {
        let mut params = std::collections::HashMap::new();
        params.insert("payment_intent".to_string(), intent_id.to_string());

        let response = self.http_client
            .post("https://api.stripe.com/v1/refunds")
            .basic_auth(&self.api_key, Some(""))
            .form(&params)
            .send()
            .await
            .map_err(|e| StripeError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(StripeError::APIError(format!(
                "Stripe error: {}",
                response.status()
            )));
        }

        let body: serde_json::Value = response.json().await
            .map_err(|e| StripeError::RequestError(e.to_string()))?;

        let refund_id = body["id"]
            .as_str()
            .ok_or_else(|| StripeError::InvalidResponse("missing refund id".to_string()))?
            .to_string();

        Ok(refund_id)
    }
}

#[derive(Debug)]
pub enum StripeError {
    RequestError(String),
    APIError(String),
    InvalidResponse(String),
}

impl std::fmt::Display for StripeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StripeError::RequestError(e) => write!(f, "Request error: {}", e),
            StripeError::APIError(e) => write!(f, "API error: {}", e),
            StripeError::InvalidResponse(e) => write!(f, "Invalid response: {}", e),
        }
    }
}

impl std::error::Error for StripeError {}
