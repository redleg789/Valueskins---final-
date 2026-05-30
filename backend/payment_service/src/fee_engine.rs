//! Platform Fee Engine
//!
//! Provider-agnostic fee calculation.
//! Calculates platform fees regardless of payment provider (Stripe, Razorpay, etc.).
//!
//! Default: flat $1.50 per transaction.
//! Supports: flat fee, percentage, hybrid (flat + percentage).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FeeType {
    Flat,
    Percentage,
    Hybrid,
}

impl FeeType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "flat" => FeeType::Flat,
            "percentage" => FeeType::Percentage,
            "hybrid" => FeeType::Hybrid,
            _ => FeeType::Flat,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeConfig {
    pub fee_type: FeeType,
    /// Flat fee in cents (e.g., 150 = $1.50)
    pub flat_fee_cents: i64,
    /// Percentage rate (e.g., 2.5 = 2.5%)
    pub percentage_rate: f64,
    /// Minimum fee in cents (percentage mode only)
    pub min_fee_cents: Option<i64>,
    /// Maximum fee in cents (percentage mode only)
    pub max_fee_cents: Option<i64>,
}

impl Default for FeeConfig {
    fn default() -> Self {
        Self {
            fee_type: FeeType::Flat,
            flat_fee_cents: 150, // $1.50 default
            percentage_rate: 0.0,
            min_fee_cents: None,
            max_fee_cents: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeBreakdown {
    pub flat_component: i64,
    pub percentage_component: i64,
    pub total_fee_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeResult {
    pub fee_cents: i64,
    pub net_amount_cents: i64,
    pub breakdown: FeeBreakdown,
    pub config_used: FeeConfig,
}

/// Provider-agnostic fee engine
pub struct FeeEngine {
    default_config: FeeConfig,
    provider_overrides: HashMap<String, FeeConfig>,
}

impl FeeEngine {
    pub fn new(config: FeeConfig) -> Self {
        Self {
            default_config: config,
            provider_overrides: HashMap::new(),
        }
    }

    pub fn with_provider_override(mut self, provider: &str, config: FeeConfig) -> Self {
        self.provider_overrides.insert(provider.to_string(), config);
        self
    }

    /// Resolve fee config for a given provider
    /// Falls back to default config if no provider-specific override
    pub fn resolve_config(&self, provider: &str) -> FeeConfig {
        self.provider_overrides
            .get(provider)
            .cloned()
            .unwrap_or_else(|| self.default_config.clone())
    }

    /// Calculate fee for a given amount and provider
    /// Provider-agnostic — same logic applies regardless of payment provider
    pub fn calculate_fee(&self, amount_cents: i64, provider: &str) -> FeeResult {
        let config = self.resolve_config(provider);
        let (fee_cents, breakdown) = Self::compute(amount_cents, &config);
        FeeResult {
            fee_cents,
            net_amount_cents: amount_cents - fee_cents,
            breakdown,
            config_used: config,
        }
    }

    fn compute(amount_cents: i64, config: &FeeConfig) -> (i64, FeeBreakdown) {
        let flat_component = match config.fee_type {
            FeeType::Flat | FeeType::Hybrid => config.flat_fee_cents,
            FeeType::Percentage => 0,
        };

        let percentage_component = match config.fee_type {
            FeeType::Percentage | FeeType::Hybrid => {
                ((amount_cents as f64) * (config.percentage_rate / 100.0)).round() as i64
            }
            FeeType::Flat => 0,
        };

        let mut total = flat_component + percentage_component;

        // Apply min/max bounds for percentage mode
        if config.fee_type == FeeType::Percentage {
            if let Some(min) = config.min_fee_cents {
                total = total.max(min);
            }
            if let Some(max) = config.max_fee_cents {
                total = total.min(max);
            }
        }

        (total, FeeBreakdown {
            flat_component,
            percentage_component,
            total_fee_cents: total,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flat_fee_default() {
        let engine = FeeEngine::new(FeeConfig::default());
        let result = engine.calculate_fee(10000, "stripe"); // $100.00
        assert_eq!(result.fee_cents, 150); // $1.50
        assert_eq!(result.net_amount_cents, 9850);
    }

    #[test]
    fn test_percentage_fee() {
        let config = FeeConfig {
            fee_type: FeeType::Percentage,
            flat_fee_cents: 0,
            percentage_rate: 2.5,
            min_fee_cents: Some(50),
            max_fee_cents: Some(2000),
        };
        let engine = FeeEngine::new(config);
        let result = engine.calculate_fee(10000, "stripe"); // $100.00 * 2.5% = $2.50
        assert_eq!(result.fee_cents, 250);
        assert_eq!(result.net_amount_cents, 9750);
    }

    #[test]
    fn test_percentage_min_bound() {
        let config = FeeConfig {
            fee_type: FeeType::Percentage,
            flat_fee_cents: 0,
            percentage_rate: 2.5,
            min_fee_cents: Some(100),
            max_fee_cents: None,
        };
        let engine = FeeEngine::new(config);
        let result = engine.calculate_fee(1000, "stripe"); // $10.00 * 2.5% = $0.25 → clamped to $1.00
        assert_eq!(result.fee_cents, 100);
    }

    #[test]
    fn test_percentage_max_bound() {
        let config = FeeConfig {
            fee_type: FeeType::Percentage,
            flat_fee_cents: 0,
            percentage_rate: 5.0,
            min_fee_cents: None,
            max_fee_cents: Some(5000),
        };
        let engine = FeeEngine::new(config);
        let result = engine.calculate_fee(500000, "stripe"); // $5000.00 * 5% = $250.00 → clamped to $50.00
        assert_eq!(result.fee_cents, 5000);
    }

    #[test]
    fn test_hybrid_fee() {
        let config = FeeConfig {
            fee_type: FeeType::Hybrid,
            flat_fee_cents: 150,
            percentage_rate: 1.0,
            min_fee_cents: None,
            max_fee_cents: None,
        };
        let engine = FeeEngine::new(config);
        let result = engine.calculate_fee(20000, "stripe"); // $200.00 → $1.50 + $2.00 = $3.50
        assert_eq!(result.fee_cents, 350);
        assert_eq!(result.net_amount_cents, 19650);
    }

    #[test]
    fn test_provider_override() {
        let default = FeeConfig::default();
        let razorpay_config = FeeConfig {
            fee_type: FeeType::Flat,
            flat_fee_cents: 200, // $2.00 for Razorpay
            percentage_rate: 0.0,
            min_fee_cents: None,
            max_fee_cents: None,
        };
        let engine = FeeEngine::new(default)
            .with_provider_override("razorpay", razorpay_config);

        let stripe_result = engine.calculate_fee(10000, "stripe");
        assert_eq!(stripe_result.fee_cents, 150); // default $1.50

        let razorpay_result = engine.calculate_fee(10000, "razorpay");
        assert_eq!(razorpay_result.fee_cents, 200); // override $2.00
    }

    #[test]
    fn test_different_amounts() {
        let engine = FeeEngine::new(FeeConfig::default());
        let result = engine.calculate_fee(500, "stripe"); // $5.00
        assert_eq!(result.fee_cents, 150); // $1.50 (flat, same regardless of amount)
        assert_eq!(result.net_amount_cents, 350);

        let result = engine.calculate_fee(1500, "stripe"); // $15.00
        assert_eq!(result.fee_cents, 150);
        assert_eq!(result.net_amount_cents, 1350);
    }
}
