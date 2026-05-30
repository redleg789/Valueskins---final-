//! Payment Processor Abstraction Layer
//! Supports: Stripe, Razorpay, Meta Pay, future providers
//! Meta can plug in their own processor without changing ValueSkins code

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PaymentProcessor {
    Stripe,
    Razorpay,
    MetaPay, // Placeholder for Meta's future processor
    Custom(String), // Extensible for custom processors
}

impl std::fmt::Display for PaymentProcessor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PaymentProcessor::Stripe => write!(f, "stripe"),
            PaymentProcessor::Razorpay => write!(f, "razorpay"),
            PaymentProcessor::MetaPay => write!(f, "meta_pay"),
            PaymentProcessor::Custom(name) => write!(f, "{}", name),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePaymentRequest {
    pub idempotency_key: String,
    pub amount_cents: i64,
    pub currency: String,
    pub customer_id: String,
    pub payment_method_id: String,
    pub description: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentResult {
    pub transaction_id: String,
    pub status: PaymentStatus,
    pub amount_cents: i64,
    pub currency: String,
    pub processor: PaymentProcessor,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Succeeded,
    Failed,
    Cancelled,
    Refunded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePayoutRequest {
    pub idempotency_key: String,
    pub amount_cents: i64,
    pub currency: String,
    pub recipient_id: String,
    pub bank_account_token: Option<String>, // Tokenized bank account
    pub wallet_address: Option<String>, // For crypto/digital wallets
    pub description: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutResult {
    pub payout_id: String,
    pub status: PayoutStatus,
    pub amount_cents: i64,
    pub currency: String,
    pub processor: PaymentProcessor,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PayoutStatus {
    Pending,
    Processing,
    Succeeded,
    Failed,
    Cancelled,
    Returned,
}

#[derive(Debug)]
pub enum ProcessorError {
    NotConfigured,
    RequestError(String),
    ValidationError(String),
    TemporaryFailure(String),
    RateLimited,
    InvalidCredentials,
}

impl std::fmt::Display for ProcessorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessorError::NotConfigured => write!(f, "Payment processor not configured"),
            ProcessorError::RequestError(e) => write!(f, "Request error: {}", e),
            ProcessorError::ValidationError(e) => write!(f, "Validation error: {}", e),
            ProcessorError::TemporaryFailure(e) => write!(f, "Temporary failure: {}", e),
            ProcessorError::RateLimited => write!(f, "Rate limited"),
            ProcessorError::InvalidCredentials => write!(f, "Invalid processor credentials"),
        }
    }
}

impl std::error::Error for ProcessorError {}

/// Trait for payment processors
/// Implement this for Stripe, Razorpay, Meta Pay, or custom processors
#[async_trait]
pub trait IPaymentProcessor: Send + Sync {
    /// Create a payment charge
    async fn create_payment(&self, req: CreatePaymentRequest) -> Result<PaymentResult, ProcessorError>;

    /// Retrieve payment status
    async fn get_payment(&self, transaction_id: &str) -> Result<PaymentResult, ProcessorError>;

    /// Refund a payment
    async fn refund_payment(&self, transaction_id: &str, amount_cents: Option<i64>) -> Result<PaymentResult, ProcessorError>;

    /// Create a payout to bank account or wallet
    async fn create_payout(&self, req: CreatePayoutRequest) -> Result<PayoutResult, ProcessorError>;

    /// Retrieve payout status
    async fn get_payout(&self, payout_id: &str) -> Result<PayoutResult, ProcessorError>;

    /// Health check / test connection
    async fn health_check(&self) -> Result<(), ProcessorError>;

    /// Get processor name
    fn name(&self) -> PaymentProcessor;
}

/// Stripe implementation stub
pub struct StripeProcessor {
    api_key: String,
}

impl StripeProcessor {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait]
impl IPaymentProcessor for StripeProcessor {
    async fn create_payment(&self, req: CreatePaymentRequest) -> Result<PaymentResult, ProcessorError> {
        // TODO: Call Stripe Payment Intents API
        // https://stripe.com/docs/payments/payment-intents
        Ok(PaymentResult {
            transaction_id: "pi_mock_stripe".to_string(),
            status: PaymentStatus::Succeeded,
            amount_cents: req.amount_cents,
            currency: req.currency,
            processor: PaymentProcessor::Stripe,
            timestamp: chrono::Utc::now(),
            error_message: None,
        })
    }

    async fn get_payment(&self, transaction_id: &str) -> Result<PaymentResult, ProcessorError> {
        todo!("Retrieve payment from Stripe")
    }

    async fn refund_payment(&self, transaction_id: &str, amount_cents: Option<i64>) -> Result<PaymentResult, ProcessorError> {
        todo!("Refund payment in Stripe")
    }

    async fn create_payout(&self, req: CreatePayoutRequest) -> Result<PayoutResult, ProcessorError> {
        // TODO: Call Stripe Payouts API
        // https://stripe.com/docs/api/payouts/create
        Ok(PayoutResult {
            payout_id: "po_mock_stripe".to_string(),
            status: PayoutStatus::Succeeded,
            amount_cents: req.amount_cents,
            currency: req.currency,
            processor: PaymentProcessor::Stripe,
            timestamp: chrono::Utc::now(),
            error_message: None,
        })
    }

    async fn get_payout(&self, payout_id: &str) -> Result<PayoutResult, ProcessorError> {
        todo!("Retrieve payout from Stripe")
    }

    async fn health_check(&self) -> Result<(), ProcessorError> {
        // TODO: Call Stripe test endpoint
        Ok(())
    }

    fn name(&self) -> PaymentProcessor {
        PaymentProcessor::Stripe
    }
}

/// Razorpay implementation stub
pub struct RazorpayProcessor {
    key_id: String,
    key_secret: String,
}

impl RazorpayProcessor {
    pub fn new(key_id: String, key_secret: String) -> Self {
        Self { key_id, key_secret }
    }
}

#[async_trait]
impl IPaymentProcessor for RazorpayProcessor {
    async fn create_payment(&self, req: CreatePaymentRequest) -> Result<PaymentResult, ProcessorError> {
        // TODO: Call Razorpay Orders API
        // https://razorpay.com/docs/payments/orders-api/
        Ok(PaymentResult {
            transaction_id: "order_mock_razorpay".to_string(),
            status: PaymentStatus::Succeeded,
            amount_cents: req.amount_cents,
            currency: req.currency,
            processor: PaymentProcessor::Razorpay,
            timestamp: chrono::Utc::now(),
            error_message: None,
        })
    }

    async fn get_payment(&self, transaction_id: &str) -> Result<PaymentResult, ProcessorError> {
        todo!("Retrieve payment from Razorpay")
    }

    async fn refund_payment(&self, transaction_id: &str, amount_cents: Option<i64>) -> Result<PaymentResult, ProcessorError> {
        todo!("Refund payment in Razorpay")
    }

    async fn create_payout(&self, req: CreatePayoutRequest) -> Result<PayoutResult, ProcessorError> {
        // TODO: Call Razorpay Payouts API
        // https://razorpay.com/docs/payouts/
        Ok(PayoutResult {
            payout_id: "payout_mock_razorpay".to_string(),
            status: PayoutStatus::Succeeded,
            amount_cents: req.amount_cents,
            currency: req.currency,
            processor: PaymentProcessor::Razorpay,
            timestamp: chrono::Utc::now(),
            error_message: None,
        })
    }

    async fn get_payout(&self, payout_id: &str) -> Result<PayoutResult, ProcessorError> {
        todo!("Retrieve payout from Razorpay")
    }

    async fn health_check(&self) -> Result<(), ProcessorError> {
        // TODO: Call Razorpay test endpoint
        Ok(())
    }

    fn name(&self) -> PaymentProcessor {
        PaymentProcessor::Razorpay
    }
}

/// Meta Pay implementation (placeholder for future integration)
pub struct MetaPayProcessor {
    // Meta will provide credentials during acquisition
    _placeholder: String,
}

#[async_trait]
impl IPaymentProcessor for MetaPayProcessor {
    async fn create_payment(&self, req: CreatePaymentRequest) -> Result<PaymentResult, ProcessorError> {
        // TODO: When Meta provides API, call their payment endpoint
        Ok(PaymentResult {
            transaction_id: "meta_txn_placeholder".to_string(),
            status: PaymentStatus::Succeeded,
            amount_cents: req.amount_cents,
            currency: req.currency,
            processor: PaymentProcessor::MetaPay,
            timestamp: chrono::Utc::now(),
            error_message: None,
        })
    }

    async fn get_payment(&self, transaction_id: &str) -> Result<PaymentResult, ProcessorError> {
        todo!("Meta payment retrieval stub")
    }

    async fn refund_payment(&self, transaction_id: &str, amount_cents: Option<i64>) -> Result<PaymentResult, ProcessorError> {
        todo!("Meta refund stub")
    }

    async fn create_payout(&self, req: CreatePayoutRequest) -> Result<PayoutResult, ProcessorError> {
        todo!("Meta payout stub")
    }

    async fn get_payout(&self, payout_id: &str) -> Result<PayoutResult, ProcessorError> {
        todo!("Meta payout retrieval stub")
    }

    async fn health_check(&self) -> Result<(), ProcessorError> {
        Ok(())
    }

    fn name(&self) -> PaymentProcessor {
        PaymentProcessor::MetaPay
    }
}

/// Payment Processor Factory — routes to correct implementation
pub struct PaymentProcessorFactory;

impl PaymentProcessorFactory {
    /// Get processor by name from environment or config
    pub fn get_processor(processor_name: &str) -> Result<Box<dyn IPaymentProcessor>, ProcessorError> {
        match processor_name {
            "stripe" => {
                let api_key = std::env::var("STRIPE_SECRET_KEY")
                    .map_err(|_| ProcessorError::NotConfigured)?;
                Ok(Box::new(StripeProcessor::new(api_key)))
            },
            "razorpay" => {
                let key_id = std::env::var("RAZORPAY_KEY_ID")
                    .map_err(|_| ProcessorError::NotConfigured)?;
                let key_secret = std::env::var("RAZORPAY_KEY_SECRET")
                    .map_err(|_| ProcessorError::NotConfigured)?;
                Ok(Box::new(RazorpayProcessor::new(key_id, key_secret)))
            },
            "meta_pay" => {
                // TODO: Meta will provide credentials during acquisition
                Ok(Box::new(MetaPayProcessor {
                    _placeholder: String::new(),
                }))
            },
            _ => Err(ProcessorError::NotConfigured),
        }
    }

    /// Get default processor from PAYMENT_PROCESSOR env var
    pub fn get_default() -> Result<Box<dyn IPaymentProcessor>, ProcessorError> {
        let default = std::env::var("PAYMENT_PROCESSOR")
            .unwrap_or_else(|_| "stripe".to_string());
        Self::get_processor(&default)
    }
}
