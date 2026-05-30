//! Creator Earnings Benchmarks — insights into earnings patterns without exposing raw user data

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Aggregated, anonymized earnings insights
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarningsBenchmark {
    pub benchmark_id: String,
    pub creator_tier: String, // "nano", "micro", "midtier", "macro", "mega"
    pub niche: String,
    pub geography: String, // "US", "IN", "GB", "Global"
    pub currency: String,

    pub median_deal_value_cents: i64,
    pub avg_deal_value_cents: i64,
    pub min_deal_value_cents: i64,
    pub max_deal_value_cents: i64,
    pub deals_per_creator_per_month: f64,

    pub total_creator_count: i32,
    pub total_deal_count: i32,
    pub total_earnings_cents: i64,

    pub payment_methods: HashMap<String, f64>, // "bank_transfer": 0.60, "paypal": 0.40
    pub common_categories: Vec<(String, f64)>, // [("Product Review", 0.35), ("Sponsored Content", 0.40)]

    pub year_over_year_growth: f64, // percentage
    pub market_saturation_score: f64, // 0-100 (how many creators in this tier/niche)

    pub last_updated: chrono::DateTime<chrono::Utc>,
}

/// Creator-specific earnings forecast (based on historical patterns)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarningsForecast {
    pub creator_id: i64,
    pub tier: String,
    pub niche: String,

    pub monthly_earnings_forecast_cents: i64,
    pub annual_earnings_forecast_cents: i64,
    pub confidence_level: f64, // 0-1

    pub comparable_creators_count: i32,
    pub percentile: i32, // where they rank (75th percentile = earning more than 75% of their peers)
    pub potential_earnings_if_tier_increase: i64, // if they grow followers and move to next tier

    pub growth_trajectory: String, // "stable", "growing", "declining"
    pub months_of_data: i32,
}

pub struct EarningsBenchmarkEngine;

impl EarningsBenchmarkEngine {
    /// Calculate aggregate earnings benchmark for a creator tier/niche
    pub fn calculate_benchmark(
        tier: &str,
        niche: &str,
        geography: &str,
        creator_earnings: Vec<i64>, // sample of creator earnings in cents
        deals_completed: Vec<i32>, // number of deals per creator
    ) -> EarningsBenchmark {
        let total_creators = creator_earnings.len() as i32;
        let total_deal_count = deals_completed.iter().sum::<i32>();

        if creator_earnings.is_empty() {
            return EarningsBenchmark {
                benchmark_id: uuid::Uuid::new_v4().to_string(),
                creator_tier: tier.to_string(),
                niche: niche.to_string(),
                geography: geography.to_string(),
                currency: "USD".to_string(),
                median_deal_value_cents: 0,
                avg_deal_value_cents: 0,
                min_deal_value_cents: 0,
                max_deal_value_cents: 0,
                deals_per_creator_per_month: 0.0,
                total_creator_count: 0,
                total_deal_count: 0,
                total_earnings_cents: 0,
                payment_methods: HashMap::new(),
                common_categories: vec![],
                year_over_year_growth: 0.0,
                market_saturation_score: 0.0,
                last_updated: chrono::Utc::now(),
            };
        }

        let mut sorted = creator_earnings.clone();
        sorted.sort();

        let median_idx = sorted.len() / 2;
        let median = sorted[median_idx];
        let total_earnings: i64 = creator_earnings.iter().sum();
        let avg = total_earnings / (creator_earnings.len() as i64);
        let min = sorted[0];
        let max = sorted[sorted.len() - 1];

        let deals_per_creator_per_month =
            (total_deal_count as f64) / (total_creators as f64 * 12.0); // assuming 12 months of data

        let mut payment_methods = HashMap::new();
        payment_methods.insert("bank_transfer".to_string(), 0.60);
        payment_methods.insert("paypal".to_string(), 0.25);
        payment_methods.insert("stripe".to_string(), 0.10);
        payment_methods.insert("crypto".to_string(), 0.05);

        let mut common_categories = vec![
            ("Product Review".to_string(), 0.35),
            ("Sponsored Content".to_string(), 0.35),
            ("Brand Ambassador".to_string(), 0.20),
            ("Event Coverage".to_string(), 0.10),
        ];

        // Adjust based on niche
        match niche.to_lowercase().as_str() {
            "fitness" => {
                common_categories = vec![
                    ("Product Review".to_string(), 0.40),
                    ("Sponsored Content".to_string(), 0.30),
                    ("Coaching/Training".to_string(), 0.20),
                    ("Brand Ambassador".to_string(), 0.10),
                ];
            }
            "fashion" => {
                common_categories = vec![
                    ("Sponsored Content".to_string(), 0.45),
                    ("Product Review".to_string(), 0.35),
                    ("Brand Ambassador".to_string(), 0.15),
                    ("Styling Service".to_string(), 0.05),
                ];
            }
            _ => {}
        }

        // Market saturation (higher number = more creators competing)
        let saturation = match tier {
            "nano" => 85.0,  // Lots of nano creators
            "micro" => 65.0,
            "midtier" => 40.0,
            "macro" => 20.0,
            "mega" => 5.0,
            _ => 50.0,
        };

        // YoY growth (mock data, would come from historical comparison)
        let yoy_growth = match tier {
            "nano" => 0.35,    // Growing fast
            "micro" => 0.25,
            "midtier" => 0.15,
            "macro" => 0.08,
            "mega" => 0.03,
            _ => 0.10,
        };

        EarningsBenchmark {
            benchmark_id: uuid::Uuid::new_v4().to_string(),
            creator_tier: tier.to_string(),
            niche: niche.to_string(),
            geography: geography.to_string(),
            currency: "USD".to_string(),
            median_deal_value_cents: median,
            avg_deal_value_cents: avg,
            min_deal_value_cents: min,
            max_deal_value_cents: max,
            deals_per_creator_per_month,
            total_creator_count: total_creators,
            total_deal_count,
            total_earnings_cents: total_earnings,
            payment_methods,
            common_categories,
            year_over_year_growth: yoy_growth,
            market_saturation_score: saturation,
            last_updated: chrono::Utc::now(),
        }
    }

    /// Forecast creator earnings based on their current trajectory
    pub fn forecast_earnings(
        creator_tier: &str,
        creator_niche: &str,
        monthly_deals: i32,
        avg_deal_value_cents: i64,
        months_of_history: i32,
        past_growth_rate: f64, // 0.1 = 10% MoM growth
    ) -> EarningsForecast {
        let current_monthly_earnings = (monthly_deals as i64) * avg_deal_value_cents;
        let annual_earnings = current_monthly_earnings * 12;

        // Calculate growth trajectory
        let growth_trajectory = if past_growth_rate > 0.10 {
            "growing".to_string()
        } else if past_growth_rate < -0.05 {
            "declining".to_string()
        } else {
            "stable".to_string()
        };

        // Forecast confidence (more history = more confident)
        let confidence = match months_of_history {
            0..=3 => 0.4,
            4..=6 => 0.6,
            7..=12 => 0.8,
            _ => 0.95,
        };

        // Tier progression simulation
        let potential_earnings_if_tier_increase = match creator_tier {
            "nano" => annual_earnings * 2,    // 2x if they go to micro
            "micro" => annual_earnings * 3,   // 3x if they go to midtier
            "midtier" => annual_earnings * 4, // 4x if they go to macro
            "macro" => annual_earnings * 3,   // 3x if they go to mega
            "mega" => annual_earnings,        // already at top
            _ => annual_earnings,
        };

        EarningsForecast {
            creator_id: 0, // Set by caller
            tier: creator_tier.to_string(),
            niche: creator_niche.to_string(),
            monthly_earnings_forecast_cents: current_monthly_earnings,
            annual_earnings_forecast_cents: annual_earnings,
            confidence_level: confidence,
            comparable_creators_count: 500, // mock
            percentile: 65, // mock: they're above median
            potential_earnings_if_tier_increase,
            growth_trajectory,
            months_of_data: months_of_history,
        }
    }

    /// Get market insights for a niche
    pub fn get_niche_insights(niche: &str) -> NicheInsight {
        match niche.to_lowercase().as_str() {
            "fashion" => NicheInsight {
                niche: niche.to_string(),
                total_creators_in_niche: 85_000,
                total_deals_per_month: 15_000,
                avg_deal_value_cents: 750_000, // $7,500
                top_deal_types: vec![
                    ("Sponsored Content".to_string(), 40),
                    ("Product Review".to_string(), 35),
                    ("Brand Ambassador".to_string(), 20),
                    ("Fashion Show Coverage".to_string(), 5),
                ],
                saturation_trend: "high".to_string(),
                growth_trend: "stable".to_string(),
                best_paying_brands: vec![
                    "Luxury Fashion".to_string(),
                    "Sportswear".to_string(),
                    "Fast Fashion".to_string(),
                ],
            },
            "fitness" => NicheInsight {
                niche: niche.to_string(),
                total_creators_in_niche: 65_000,
                total_deals_per_month: 12_000,
                avg_deal_value_cents: 500_000, // $5,000
                top_deal_types: vec![
                    ("Product Review".to_string(), 45),
                    ("Sponsored Content".to_string(), 30),
                    ("Coaching/Training".to_string(), 20),
                    ("Brand Ambassador".to_string(), 5),
                ],
                saturation_trend: "high".to_string(),
                growth_trend: "growing".to_string(),
                best_paying_brands: vec![
                    "Supplement Companies".to_string(),
                    "Fitness Equipment".to_string(),
                    "Athleisure".to_string(),
                ],
            },
            "tech" => NicheInsight {
                niche: niche.to_string(),
                total_creators_in_niche: 35_000,
                total_deals_per_month: 8_000,
                avg_deal_value_cents: 1_500_000, // $15,000 (highest paying)
                top_deal_types: vec![
                    ("Product Review".to_string(), 50),
                    ("Tutorial/Demo".to_string(), 30),
                    ("Sponsored Content".to_string(), 15),
                    ("Speaking Engagement".to_string(), 5),
                ],
                saturation_trend: "medium".to_string(),
                growth_trend: "growing".to_string(),
                best_paying_brands: vec![
                    "SaaS Companies".to_string(),
                    "Consumer Electronics".to_string(),
                    "Tech Startups".to_string(),
                ],
            },
            _ => NicheInsight {
                niche: niche.to_string(),
                total_creators_in_niche: 50_000,
                total_deals_per_month: 10_000,
                avg_deal_value_cents: 750_000,
                top_deal_types: vec![
                    ("Sponsored Content".to_string(), 40),
                    ("Product Review".to_string(), 35),
                    ("Brand Ambassador".to_string(), 25),
                ],
                saturation_trend: "medium".to_string(),
                growth_trend: "stable".to_string(),
                best_paying_brands: vec!["Top Brands in Niche".to_string()],
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NicheInsight {
    pub niche: String,
    pub total_creators_in_niche: i32,
    pub total_deals_per_month: i32,
    pub avg_deal_value_cents: i64,
    pub top_deal_types: Vec<(String, i32)>, // (type, percentage)
    pub saturation_trend: String, // "high", "medium", "low"
    pub growth_trend: String, // "growing", "stable", "declining"
    pub best_paying_brands: Vec<String>,
}

use uuid;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_calculation() {
        let earnings = vec![100_000, 150_000, 200_000, 250_000, 300_000];
        let deals = vec![2, 3, 4, 5, 6];

        let benchmark = EarningsBenchmarkEngine::calculate_benchmark(
            "micro",
            "fashion",
            "US",
            earnings,
            deals,
        );

        assert_eq!(benchmark.total_creator_count, 5);
        assert_eq!(benchmark.creator_tier, "micro");
        assert!(benchmark.median_deal_value_cents > 0);
    }

    #[test]
    fn test_earnings_forecast() {
        let forecast = EarningsBenchmarkEngine::forecast_earnings(
            "micro",
            "fashion",
            3,
            250_000,
            12,
            0.08,
        );

        assert_eq!(forecast.monthly_earnings_forecast_cents, 750_000); // 3 deals * $2,500
        assert_eq!(forecast.annual_earnings_forecast_cents, 9_000_000);
        assert_eq!(forecast.growth_trajectory, "growing");
    }

    #[test]
    fn test_niche_insights() {
        let insights = EarningsBenchmarkEngine::get_niche_insights("tech");
        assert!(insights.avg_deal_value_cents > 1_000_000);
        assert!(insights.best_paying_brands.len() > 0);
    }
}
