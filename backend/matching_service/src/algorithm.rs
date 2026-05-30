//! Creator-Brand Matching Algorithm — pure logic, no external calls

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Result of matching a creator to a brand opportunity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchScore {
    pub creator_id: i64,
    pub opportunity_id: i64,
    pub overall_score: f64, // 0-100
    pub component_scores: MatchComponents,
    pub reasoning: String,
    pub recommendation: MatchRecommendation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchComponents {
    pub audience_fit: f64, // does brand's target audience match creator's followers?
    pub engagement_quality: f64, // is engagement real and authentic?
    pub niche_alignment: f64, // does creator's niche match opportunity category?
    pub tier_fit: f64, // is creator tier appropriate for budget?
    pub compliance_score: f64, // no fraud risk, verified account, etc
    pub past_performance: f64, // reputation from previous deals
    pub geographic_fit: f64, // does creator's audience match brand's target geography?
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MatchRecommendation {
    Strong,     // 80+ score, recommend immediately
    Promising,  // 60-79, worth considering
    Weak,       // 40-59, might work but not ideal
    Poor,       // <40, not recommended
}

impl MatchScore {
    /// Main matching algorithm: takes creator profile + opportunity + brand and returns match score
    pub fn calculate(
        creator_tier: &str,
        creator_followers: i64,
        creator_engagement_rate: f64,
        creator_niche: &str,
        creator_brand_safety: f64,
        creator_reputation: f64,
        creator_past_deals: i32,

        opportunity_category: &str,
        opportunity_budget: i64,
        opportunity_target_tier: &str,
        opportunity_target_niche: &str,
        opportunity_audience: &[String], // ["18-24", "25-34"]

        brand_verified: bool,
        brand_previous_campaigns: i32,
    ) -> MatchScore {
        let mut components = MatchComponents {
            audience_fit: 0.0,
            engagement_quality: 0.0,
            niche_alignment: 0.0,
            tier_fit: 0.0,
            compliance_score: 0.0,
            past_performance: 0.0,
            geographic_fit: 0.0,
        };

        // 1. NICHE ALIGNMENT (20 points possible)
        components.niche_alignment = if creator_niche.to_lowercase() == opportunity_target_niche.to_lowercase() {
            20.0
        } else if Self::niches_related(creator_niche, opportunity_target_niche) {
            15.0
        } else {
            5.0
        };

        // 2. TIER FIT (20 points possible)
        // Budget should match creator tier expectations
        let tier_budget_min = match opportunity_target_tier {
            "nano" => 500,
            "micro" => 2_000,
            "midtier" => 10_000,
            "macro" => 50_000,
            "mega" => 250_000,
            _ => 1_000,
        };

        let tier_budget_max = tier_budget_min * 10;

        if opportunity_budget >= tier_budget_min && opportunity_budget <= tier_budget_max {
            components.tier_fit = 20.0;
        } else if (opportunity_budget as f64) >= (tier_budget_min as f64 * 0.5)
            && (opportunity_budget as f64) <= (tier_budget_max as f64 * 2.0)
        {
            components.tier_fit = 15.0;
        } else {
            components.tier_fit = 5.0;
        }

        // 3. AUDIENCE FIT (20 points possible)
        // Does creator's followers match opportunity's target audience?
        let follower_range_min = match opportunity_target_tier {
            "nano" => 1_000,
            "micro" => 10_000,
            "midtier" => 100_000,
            "macro" => 1_000_000,
            "mega" => 10_000_000,
            _ => 1_000,
        };

        let follower_range_max = follower_range_min * 10;

        if creator_followers >= follower_range_min && creator_followers <= follower_range_max {
            components.audience_fit = 20.0;
        } else if creator_followers >= (follower_range_min / 2) && creator_followers <= (follower_range_max * 2) {
            components.audience_fit = 15.0;
        } else {
            components.audience_fit = 5.0;
        }

        // 4. ENGAGEMENT QUALITY (15 points possible)
        // High engagement = real audience
        if creator_engagement_rate > 5.0 && creator_engagement_rate < 15.0 {
            components.engagement_quality = 15.0; // sweet spot
        } else if creator_engagement_rate > 2.0 && creator_engagement_rate < 20.0 {
            components.engagement_quality = 12.0; // acceptable
        } else if creator_engagement_rate > 0.5 {
            components.engagement_quality = 8.0; // below average
        } else {
            components.engagement_quality = 0.0; // dead account
        }

        // 5. COMPLIANCE (15 points possible)
        // Brand safety + fraud risk combined
        components.compliance_score = (creator_brand_safety / 100.0) * 15.0;

        // 6. PAST PERFORMANCE (10 points possible)
        // Creator reputation from previous deals
        components.past_performance = (creator_reputation / 100.0) * 10.0;
        if creator_past_deals > 10 {
            components.past_performance += 2.0; // bonus for volume
        }
        components.past_performance = components.past_performance.min(10.0);

        // 7. GEOGRAPHIC FIT (5 points possible)
        // Brand's target geography (simplified; would use actual geo data in production)
        if brand_verified {
            components.geographic_fit = 5.0; // verified brands are flexible
        } else {
            components.geographic_fit = 3.0;
        }

        let overall_score = components.audience_fit
            + components.engagement_quality
            + components.niche_alignment
            + components.tier_fit
            + components.compliance_score
            + components.past_performance
            + components.geographic_fit;

        let recommendation = match overall_score {
            s if s >= 80.0 => MatchRecommendation::Strong,
            s if s >= 60.0 => MatchRecommendation::Promising,
            s if s >= 40.0 => MatchRecommendation::Weak,
            _ => MatchRecommendation::Poor,
        };

        let reasoning = format!(
            "Niche alignment: {:.1}% | Tier fit: {:.1}% | Audience: {:.1}% | Engagement: {:.1}% | Compliance: {:.1}% | History: {:.1}%",
            (components.niche_alignment / 20.0) * 100.0,
            (components.tier_fit / 20.0) * 100.0,
            (components.audience_fit / 20.0) * 100.0,
            (components.engagement_quality / 15.0) * 100.0,
            (components.compliance_score / 15.0) * 100.0,
            (components.past_performance / 10.0) * 100.0,
        );

        MatchScore {
            creator_id: 0, // set by caller
            opportunity_id: 0, // set by caller
            overall_score,
            component_scores: components,
            reasoning,
            recommendation,
        }
    }

    /// Check if two niches are related (e.g., "fashion" and "beauty" are related)
    fn niches_related(niche1: &str, niche2: &str) -> bool {
        let niche1 = niche1.to_lowercase();
        let niche2 = niche2.to_lowercase();

        let related_groups = vec![
            vec!["fashion", "style", "beauty", "makeup"],
            vec!["fitness", "health", "wellness", "yoga"],
            vec!["food", "cooking", "recipe", "restaurant"],
            vec!["travel", "adventure", "tourism"],
            vec!["tech", "startup", "coding", "innovation"],
            vec!["music", "artist", "producer"],
            vec!["gaming", "esports", "streamer"],
        ];

        for group in related_groups {
            if group.contains(&niche1.as_str()) && group.contains(&niche2.as_str()) {
                return true;
            }
        }

        false
    }

    /// Batch match creators to an opportunity (returns top N matches)
    pub fn batch_match_creators(
        creators: Vec<CreatorMatchInput>,
        opportunity: OpportunityInput,
        top_n: usize,
    ) -> Vec<MatchScore> {
        let mut matches: Vec<MatchScore> = creators
            .into_iter()
            .enumerate()
            .map(|(idx, creator)| {
                let mut score = Self::calculate(
                    &creator.tier,
                    creator.followers,
                    creator.engagement_rate,
                    &creator.niche,
                    creator.brand_safety,
                    creator.reputation,
                    creator.past_deals,
                    &opportunity.category,
                    opportunity.budget,
                    &opportunity.target_tier,
                    &opportunity.target_niche,
                    &opportunity.target_audience,
                    opportunity.brand_verified,
                    opportunity.brand_campaigns,
                );
                score.creator_id = creator.creator_id;
                score.opportunity_id = opportunity.opportunity_id;
                score
            })
            .collect();

        // Sort by overall score descending
        matches.sort_by(|a, b| b.overall_score.partial_cmp(&a.overall_score).unwrap());

        matches.into_iter().take(top_n).collect()
    }
}

#[derive(Debug, Clone)]
pub struct CreatorMatchInput {
    pub creator_id: i64,
    pub tier: String,
    pub followers: i64,
    pub engagement_rate: f64,
    pub niche: String,
    pub brand_safety: f64,
    pub reputation: f64,
    pub past_deals: i32,
}

#[derive(Debug, Clone)]
pub struct OpportunityInput {
    pub opportunity_id: i64,
    pub category: String,
    pub budget: i64,
    pub target_tier: String,
    pub target_niche: String,
    pub target_audience: Vec<String>,
    pub brand_verified: bool,
    pub brand_campaigns: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perfect_match() {
        let score = MatchScore::calculate(
            "micro",      // creator tier
            50_000,       // followers
            6.0,          // engagement
            "fashion",    // niche
            85.0,         // brand safety
            80.0,         // reputation
            5,            // past deals
            "fashion",    // opportunity category
            5_000,        // budget (cents)
            "micro",      // target tier
            "fashion",    // target niche
            &["18-24".to_string(), "25-34".to_string()],
            true,         // brand verified
            3,            // brand campaigns
        );

        assert!(score.overall_score > 80.0);
        assert_eq!(score.recommendation, MatchRecommendation::Strong);
    }

    #[test]
    fn test_poor_match() {
        let score = MatchScore::calculate(
            "nano",      // too small
            2_000,       // too few followers
            1.0,         // low engagement
            "gaming",    // unrelated niche
            30.0,        // poor safety
            20.0,        // low reputation
            0,           // no history
            "fashion",   // opportunity wants fashion
            5_000,       // budget mismatch
            "macro",     // opportunity wants macro
            "fashion",   // wants fashion
            &["25-34".to_string()],
            false,
            1,
        );

        assert!(score.overall_score < 40.0);
        assert_eq!(score.recommendation, MatchRecommendation::Poor);
    }

    #[test]
    fn test_niche_related() {
        assert!(MatchScore::niches_related("fashion", "beauty"));
        assert!(MatchScore::niches_related("fitness", "wellness"));
        assert!(!MatchScore::niches_related("gaming", "fashion"));
    }
}
