//! Anti-Fraud & Brand Safety Engine — detects fake creators, bot activity, brand safety issues

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Overall fraud risk assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FraudRiskAssessment {
    pub creator_id: i64,
    pub overall_risk_score: f64, // 0-100 (0=safe, 100=high risk)
    pub risk_level: RiskLevel,
    pub risk_factors: Vec<RiskFactor>,
    pub recommended_action: RecommendedAction,
    pub verification_status: VerificationStatus,
    pub assessment_date: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Green,   // 0-25 (safe)
    Yellow,  // 26-50 (caution)
    Orange,  // 51-75 (suspicious)
    Red,     // 76-100 (likely fraud)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactor {
    pub category: String, // "engagement_anomaly", "follower_quality", "account_age", etc
    pub risk_type: String,
    pub severity: f64, // 0-100
    pub evidence: String,
    pub remediation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendedAction {
    Approve,                     // Safe to approve for deals
    ApproveWithMonitoring,       // Approve but flag for reviews
    RequireAdditionalVerification, // Ask for ID, address, etc
    SuspendPendingInvestigation, // Temp suspend pending human review
    Reject,                      // Reject outright
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationStatus {
    pub identity_verified: bool,
    pub phone_verified: bool,
    pub email_verified: bool,
    pub payment_method_verified: bool,
    pub previous_deals_verified: bool,
}

/// Brand safety assessment (opposite of fraud, more about content safety)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrandSafetyAssessment {
    pub creator_id: i64,
    pub brand_safety_score: f64, // 0-100 (100=safe, 0=unsafe)
    pub content_categories: Vec<ContentCategory>,
    pub red_flags: Vec<String>, // e.g., "adult content", "hate speech", "extremist content"
    pub brand_suitability: HashMap<String, f64>, // "luxury": 0.9, "family": 0.3
    pub assessment_date: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentCategory {
    pub category: String, // "lifestyle", "explicit", "political", "controversial"
    pub confidence: f64,  // 0-1
    pub examples: Vec<String>, // sample posts
}

pub struct FraudDetectionEngine;

impl FraudDetectionEngine {
    /// Main fraud risk assessment
    pub fn assess_fraud_risk(
        account_age_days: i32,
        follower_count: i64,
        engagement_rate: f64,
        follower_growth_rate_per_day: f64,
        post_frequency_variance: f64,
        bio_changes_30_days: i32,
        deleted_posts_count: i32,
        comment_engagement_rate: f64,
        hashtag_consistency: f64,
        posting_time_variance: f64,
        previous_deal_completion_rate: f64,
        account_linked_accounts: usize,
    ) -> FraudRiskAssessment {
        let mut risk_factors = Vec::new();
        let mut total_risk: f64 = 0.0;

        // 1. ACCOUNT AGE (0-15 points)
        let age_risk = match account_age_days {
            0..=30 => {
                risk_factors.push(RiskFactor {
                    category: "account_age".to_string(),
                    risk_type: "newly_created".to_string(),
                    severity: 15.0,
                    evidence: format!("Account only {} days old", account_age_days),
                    remediation: "Require email + phone verification".to_string(),
                });
                15.0
            }
            31..=90 => 10.0,
            91..=365 => 5.0,
            _ => 0.0,
        };
        total_risk += age_risk;

        // 2. FOLLOWER QUALITY (0-20 points)
        let follower_growth_risk = if follower_growth_rate_per_day > 1.0 {
            risk_factors.push(RiskFactor {
                category: "follower_quality".to_string(),
                risk_type: "suspicious_growth".to_string(),
                severity: 20.0,
                evidence: format!("Gaining {:.2}% followers/day (bot-like)", follower_growth_rate_per_day),
                remediation: "Require audit of follower growth source".to_string(),
            });
            20.0
        } else if follower_growth_rate_per_day > 0.5 {
            8.0
        } else {
            0.0
        };
        total_risk += follower_growth_risk;

        // 3. ENGAGEMENT RATE (0-20 points)
        let engagement_risk = match engagement_rate {
            e if e > 30.0 => {
                risk_factors.push(RiskFactor {
                    category: "engagement_anomaly".to_string(),
                    risk_type: "unusually_high_engagement".to_string(),
                    severity: 20.0,
                    evidence: format!("Engagement rate {:.2}% (normal is 1-5%)", e),
                    remediation: "Likely bot engagement; require manual review".to_string(),
                });
                20.0
            }
            e if e > 15.0 => 12.0,
            e if e < 0.5 && follower_count > 10_000 => {
                risk_factors.push(RiskFactor {
                    category: "engagement_anomaly".to_string(),
                    risk_type: "dead_account".to_string(),
                    severity: 15.0,
                    evidence: format!("{} followers but only {:.2}% engagement", follower_count, e),
                    remediation: "Account appears inactive despite followers".to_string(),
                });
                15.0
            }
            _ => 0.0,
        };
        total_risk += engagement_risk;

        // 4. POSTING PATTERNS (0-15 points)
        let posting_risk = match post_frequency_variance {
            v if v > 0.8 => {
                risk_factors.push(RiskFactor {
                    category: "posting_pattern".to_string(),
                    risk_type: "erratic_posting".to_string(),
                    severity: 10.0,
                    evidence: "Post frequency highly erratic (bot?-like or abandoned then revived)".to_string(),
                    remediation: "Clarify posting schedule".to_string(),
                });
                10.0
            }
            v if v > 0.5 => 5.0,
            _ => 0.0,
        };
        total_risk += posting_risk;

        // 5. BIO/PROFILE CHANGES (0-10 points)
        let bio_change_risk = if bio_changes_30_days > 3 {
            risk_factors.push(RiskFactor {
                category: "profile_stability".to_string(),
                risk_type: "rapid_bio_changes".to_string(),
                severity: 10.0,
                evidence: format!("Bio changed {} times in 30 days", bio_changes_30_days),
                remediation: "May indicate account takeover; require 2FA".to_string(),
            });
            10.0
        } else if bio_changes_30_days > 1 {
            5.0
        } else {
            0.0
        };
        total_risk += bio_change_risk;

        // 6. DELETED POSTS (0-10 points)
        let deletion_risk = if deleted_posts_count > 10 {
            risk_factors.push(RiskFactor {
                category: "content_integrity".to_string(),
                risk_type: "mass_deletions".to_string(),
                severity: 10.0,
                evidence: format!("{} posts deleted (hiding something?)", deleted_posts_count),
                remediation: "Ask creator to explain deletions".to_string(),
            });
            10.0
        } else {
            0.0
        };
        total_risk += deletion_risk;

        // 7. COMMENT ENGAGEMENT (0-10 points)
        let comment_risk = if comment_engagement_rate < 0.5 && follower_count > 50_000 {
            risk_factors.push(RiskFactor {
                category: "engagement_quality".to_string(),
                risk_type: "low_comment_engagement".to_string(),
                severity: 8.0,
                evidence: format!("Only {:.2}% of followers comment", comment_engagement_rate),
                remediation: "May be bot followers; ask for verification".to_string(),
            });
            8.0
        } else {
            0.0
        };
        total_risk += comment_risk;

        // 8. PREVIOUS DEAL HISTORY (0-negative points = trust)
        let history_bonus = if previous_deal_completion_rate > 0.9 {
            -15.0 // Established creator with good history
        } else if previous_deal_completion_rate > 0.7 {
            -10.0
        } else if previous_deal_completion_rate > 0.5 {
            -5.0
        } else {
            0.0
        };
        total_risk += history_bonus;

        // 9. LINKED ACCOUNTS (negative = more trusted)
        if account_linked_accounts >= 2 {
            total_risk -= 10.0; // Harder to fake across multiple platforms
        }

        let overall_risk_score = total_risk.max(0.0).min(100.0);
        let risk_level = match overall_risk_score {
            s if s <= 25.0 => RiskLevel::Green,
            s if s <= 50.0 => RiskLevel::Yellow,
            s if s <= 75.0 => RiskLevel::Orange,
            _ => RiskLevel::Red,
        };

        let recommended_action = match risk_level {
            RiskLevel::Green => RecommendedAction::Approve,
            RiskLevel::Yellow => RecommendedAction::ApproveWithMonitoring,
            RiskLevel::Orange => RecommendedAction::RequireAdditionalVerification,
            RiskLevel::Red => RecommendedAction::SuspendPendingInvestigation,
        };

        FraudRiskAssessment {
            creator_id: 0, // Set by caller
            overall_risk_score,
            risk_level,
            risk_factors,
            recommended_action,
            verification_status: VerificationStatus {
                identity_verified: false,
                phone_verified: false,
                email_verified: false,
                payment_method_verified: false,
                previous_deals_verified: previous_deal_completion_rate > 0.0,
            },
            assessment_date: chrono::Utc::now(),
        }
    }

    /// Brand safety assessment (simplified content safety heuristic)
    pub fn assess_brand_safety(
        niche: &str,
        keywords_in_bio: &[&str],
        flagged_post_count: i32,
    ) -> BrandSafetyAssessment {
        let mut red_flags = Vec::new();
        let mut brand_safety_score = 80.0; // Start high

        // Check for explicit/adult content keywords
        let explicit_keywords = vec!["adult", "18+", "nsfw", "xxx", "porn"];
        for keyword in explicit_keywords {
            if keywords_in_bio.iter().any(|k| k.contains(keyword)) {
                red_flags.push("Adult content".to_string());
                brand_safety_score -= 50.0;
            }
        }

        // Check for controversial/political keywords
        let political_keywords = vec!["political", "campaign", "vote", "extremist", "conspiracy"];
        for keyword in political_keywords {
            if keywords_in_bio.iter().any(|k| k.contains(keyword)) {
                red_flags.push("Political content".to_string());
                brand_safety_score -= 20.0;
            }
        }

        // Adjust for flagged posts
        if flagged_post_count > 0 {
            red_flags.push(format!("{} flagged posts", flagged_post_count));
            brand_safety_score -= (flagged_post_count as f64) * 5.0;
        }

        // Brand suitability by niche
        let mut brand_suitability = HashMap::new();
        match niche.to_lowercase().as_str() {
            "fashion" => {
                brand_suitability.insert("luxury".to_string(), 0.9);
                brand_suitability.insert("family".to_string(), 0.7);
                brand_suitability.insert("finance".to_string(), 0.3);
            }
            "fitness" => {
                brand_suitability.insert("health".to_string(), 0.95);
                brand_suitability.insert("family".to_string(), 0.8);
                brand_suitability.insert("alcohol".to_string(), 0.2);
            }
            "gaming" => {
                brand_suitability.insert("tech".to_string(), 0.95);
                brand_suitability.insert("family".to_string(), 0.4);
                brand_suitability.insert("luxury".to_string(), 0.3);
            }
            _ => {
                brand_suitability.insert("general".to_string(), 0.7);
            }
        }

        BrandSafetyAssessment {
            creator_id: 0, // Set by caller
            brand_safety_score: brand_safety_score.max(0.0).min(100.0),
            content_categories: vec![ContentCategory {
                category: niche.to_string(),
                confidence: 0.8,
                examples: vec![],
            }],
            red_flags,
            brand_suitability,
            assessment_date: chrono::Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_healthy_creator() {
        let assessment = FraudDetectionEngine::assess_fraud_risk(
            500,  // account age: 500 days
            100_000,
            5.0,  // engagement rate
            0.1,  // growth rate
            0.3,  // post variance (low = consistent)
            0,    // bio changes
            0,    // deleted posts
            2.0,  // comment engagement
            0.8,  // hashtag consistency
            0.2,  // posting time variance
            0.95, // deal completion
            2,    // linked accounts
        );

        assert!(assessment.overall_risk_score < 25.0);
        assert_eq!(assessment.risk_level, RiskLevel::Green);
    }

    #[test]
    fn test_suspicious_creator() {
        let assessment = FraudDetectionEngine::assess_fraud_risk(
            10,   // very new
            10_000,
            25.0, // suspiciously high engagement
            2.0,  // very high growth
            0.9,  // erratic posting
            5,    // bio changed 5 times
            20,   // many deleted posts
            0.1,  // no comments
            0.2,  // inconsistent hashtags
            0.8,  // posting time all over
            0.0,  // no deal history
            1,    // only 1 platform
        );

        assert!(assessment.overall_risk_score > 50.0);
        assert_eq!(assessment.risk_level, RiskLevel::Orange);
    }

    #[test]
    fn test_brand_safety() {
        let assessment = FraudDetectionEngine::assess_brand_safety(
            "fashion",
            &["luxury", "style"],
            0,
        );

        assert!(assessment.brand_safety_score > 70.0);
        assert!(assessment.red_flags.is_empty());
    }
}
