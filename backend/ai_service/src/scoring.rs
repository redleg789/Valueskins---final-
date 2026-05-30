use serde::{Deserialize, Serialize};

// ============================================================================
// PATENT-RELEVANT: Multi-Signal Creator Reputation Scoring
// with Automatic Tier Migration and Asymmetric Marketplace Pricing
// ============================================================================
//
// PATENT CLAIM: A method for automatically adjusting a content creator's
// marketplace pricing tier based on a multi-signal reputation score comprising:
//   (a) follower count scaled logarithmically to prevent purchased-follower gaming,
//   (b) engagement authenticity weighted by interaction type (comments > shares > likes),
//   (c) bot detection heuristics combining engagement ratio anomalies, follower growth
//       spike detection, and comment-to-like ratio analysis,
//   (d) content consistency measured by posting frequency and audience growth trend,
// wherein tier changes automatically modify the creator's pricing multiplier
// in a brand-creator marketplace without manual intervention.
//
// NOVEL ASPECTS:
// 1. Logarithmic follower scaling prevents buying followers from gaming level
// 2. Bot score is a COMPOSITE HEURISTIC, not a binary flag
// 3. Level changes auto-migrate pricing (L1=1x → L5=10x) with NO human review
// 4. The SAME score feeds DIFFERENT weights in the dual-perspective marketplace
// ============================================================================

/// Input for the enhanced 5-level scoring algorithm
#[derive(Debug, Serialize, Deserialize)]
pub struct ScoringInput {
    pub follower_count: u64,
    pub avg_likes_per_post: f64,
    pub avg_comments_per_post: f64,
    pub avg_shares_per_post: f64,
    pub post_count_last_30_days: u32,
    pub follower_growth_last_30_days: i64,
    pub account_age_days: u64,
}

/// Result of the scoring algorithm
#[derive(Debug, Serialize, Deserialize)]
pub struct ScoreResult {
    pub total_score: u32,           // 0 to 10000
    pub follower_score: u32,        // 0 to 2500 (25% weight)
    pub engagement_score: u32,      // 0 to 3500 (35% weight)
    pub authenticity_score: u32,    // 0 to 2500 (25% weight)
    pub consistency_score: u32,     // 0 to 1500 (15% weight)
    pub bot_score: f64,             // 0.0 (clean) to 1.0 (all bots)
    pub level: u8,                  // 1 to 5
    pub level_multiplier: f64,      // 1.0x to 10.0x
    pub next_level_threshold: u32,  // Score needed for next level
}

/// Brand-creator matching input (for dual-perspective MIM)
#[derive(Debug, Serialize, Deserialize)]
pub struct MatchingInput {
    pub creator_score: u32,
    pub creator_level: u8,
    pub creator_category: String,
    pub creator_engagement_rate: f64,
    pub brand_category: String,
    pub brand_min_engagement_rate: f64,
    pub brand_min_level: u8,
    pub brand_base_budget: u32,
}

/// Asymmetric match scores — DIFFERENT scores for the SAME pair
#[derive(Debug, Serialize, Deserialize)]
pub struct MatchScore {
    pub opportunity_fit_score: u32,    // What the CREATOR sees
    pub creator_quality_score: u32,    // What the BRAND sees
    pub category_affinity: u32,
    pub engagement_match: u32,
    pub level_bonus: u32,
    pub is_qualified: bool,
    pub match_reason: String,
    pub estimated_deal_value: u32,     // In cents
}

/// Calculate the 5-level reputation score
pub fn calculate_score(input: &ScoringInput) -> ScoreResult {
    // 1. FOLLOWER SCORE (25% weight, max 2500)
    // Logarithmic scaling prevents buying followers from gaming the system.
    // ln(1M) ≈ 13.8, ln(5M) ≈ 15.4 — diminishing returns at scale.
    let follower_score = if input.follower_count == 0 {
        0
    } else {
        let log_followers = (input.follower_count as f64).ln();
        ((log_followers / 14.5) * 2500.0).min(2500.0) as u32
    };

    // 2. ENGAGEMENT SCORE (35% weight, max 3500)
    // Weighted by interaction type: comments > shares > likes
    // This rewards genuine audience interaction, not passive consumption.
    let engagement_rate = if input.follower_count == 0 {
        0.0
    } else {
        let weighted_interactions = input.avg_likes_per_post
            + input.avg_comments_per_post * 2.0
            + input.avg_shares_per_post * 3.0;
        (weighted_interactions / input.follower_count as f64) * 100.0
    };
    let engagement_score = ((engagement_rate / 15.0).min(1.0) * 3500.0) as u32;

    // 3. AUTHENTICITY SCORE (25% weight, max 2500)
    // Composite bot detection heuristic (the patentable part)
    let bot_score = calculate_bot_score(input);
    let authenticity_score = ((1.0 - bot_score) * 2500.0) as u32;

    // 4. CONSISTENCY SCORE (15% weight, max 1500)
    // Rewards regular posting + positive audience growth
    let posts_per_day = input.post_count_last_30_days as f64 / 30.0;
    let consistency_base = (posts_per_day / 2.0).min(1.0); // 2 posts/day = perfect
    let growth_factor = if input.follower_growth_last_30_days > 0 { 1.2 } else { 0.8 };
    let consistency_score = (consistency_base * growth_factor * 1500.0).min(1500.0) as u32;

    // TOTAL
    let total_score = (follower_score + engagement_score + authenticity_score + consistency_score).min(10000);

    // LEVEL DETERMINATION (5 levels with graduated thresholds)
    let (level, next_threshold) = match total_score {
        0..=2499     => (1, 2500),
        2500..=4999  => (2, 5000),
        5000..=7499  => (3, 7500),
        7500..=8999  => (4, 9000),
        _            => (5, 10000),
    };

    // PRICING MULTIPLIER — auto-migrates with level, no human review
    let level_multiplier = match level {
        1 => 1.0,
        2 => 1.5,
        3 => 2.5,
        4 => 5.0,
        5 => 10.0,
        _ => 1.0,
    };

    ScoreResult {
        total_score,
        follower_score,
        engagement_score,
        authenticity_score,
        consistency_score,
        bot_score,
        level,
        level_multiplier,
        next_level_threshold: next_threshold,
    }
}

/// Composite bot detection heuristic
///
/// Returns 0.0 (definitely real) to 1.0 (definitely bots)
///
/// Three independent signals combined:
///   (a) Engagement ratio anomaly — real audiences have >0.5% engagement
///   (b) Follower growth spike — >50% growth in 30 days for established accounts
///   (c) Comment-to-like ratio — bot likes produce ratios >100:1
fn calculate_bot_score(input: &ScoringInput) -> f64 {
    let mut bot_indicators = 0.0;

    // Signal 1: Suspiciously low engagement rate (<0.5%)
    if input.follower_count > 0 {
        let engagement_rate = input.avg_likes_per_post / input.follower_count as f64;
        if engagement_rate < 0.005 {
            bot_indicators += 0.3;
        }
    }

    // Signal 2: Sudden follower spikes (>50% in 30 days for accounts with >10K)
    if input.follower_count > 10000 {
        let growth_rate = input.follower_growth_last_30_days as f64 / input.follower_count as f64;
        if growth_rate > 0.5 {
            bot_indicators += 0.4;
        }
    }

    // Signal 3: Very low comments relative to likes (ratio > 100:1)
    if input.avg_comments_per_post > 0.0 {
        let like_comment_ratio = input.avg_likes_per_post / input.avg_comments_per_post;
        if like_comment_ratio > 100.0 {
            bot_indicators += 0.3;
        }
    } else if input.avg_likes_per_post > 100.0 {
        // Lots of likes but zero comments = very suspicious
        bot_indicators += 0.3;
    }

    f64::min(bot_indicators, 1.0)
}

/// Calculate asymmetric match scores for dual-perspective marketplace
///
/// PATENT: The SAME (brand, creator) pair produces DIFFERENT scores
/// depending on which side is viewing. This is fundamentally different
/// from symmetric marketplaces where both sides see the same ranking.
pub fn calculate_brand_match(input: &MatchingInput) -> MatchScore {
    // Category Affinity (shared component, 40% of each perspective)
    let category_affinity = if input.creator_category == input.brand_category {
        4000 // Perfect match
    } else if input.creator_category == "Content Creator" {
        2000 // General creators can match any brand (weaker)
    } else {
        500 // Cross-category (weak)
    };

    // Engagement Match — weighted DIFFERENTLY per perspective
    let engagement_score = if input.creator_engagement_rate >= input.brand_min_engagement_rate {
        ((input.creator_engagement_rate / 10.0).min(1.0) * 3500.0) as u32
    } else {
        0
    };

    // Level Bonus — weighted DIFFERENTLY per perspective
    let level_bonus = if input.creator_level >= input.brand_min_level {
        (((input.creator_level - input.brand_min_level) as u32) * 625).min(2500)
    } else {
        0
    };

    let is_qualified = input.creator_level >= input.brand_min_level;

    // ASYMMETRIC SCORES — the patent-worthy mechanism
    //
    // Creator perspective: "How good is this deal for ME?"
    // Emphasizes budget match and qualification, less about engagement
    let opportunity_fit_score = (
        category_affinity
        + (engagement_score as f64 * 0.8) as u32  // Budget proxy (lower weight)
        + (level_bonus as f64 * 1.2) as u32        // Qualification bonus (higher weight)
    ).min(10000);

    // Brand perspective: "How good is this creator for MY campaign?"
    // Emphasizes engagement authenticity and level value
    let creator_quality_score = (
        category_affinity
        + (engagement_score as f64 * 1.2) as u32   // Engagement (higher weight)
        + (level_bonus as f64 * 0.8) as u32         // Level (lower weight)
    ).min(10000);

    // Pricing estimate: base budget * creator's level multiplier
    let multiplier = match input.creator_level {
        1 => 1.0, 2 => 1.5, 3 => 2.5, 4 => 5.0, 5 => 10.0, _ => 1.0,
    };
    let estimated_deal_value = (input.brand_base_budget as f64 * multiplier) as u32;

    // Generate human-readable match reason
    let match_reason = if category_affinity >= 4000 && engagement_score >= 2500 {
        format!("Perfect category match + strong engagement ({:.1}%)", input.creator_engagement_rate)
    } else if category_affinity >= 4000 {
        "Exact category match".to_string()
    } else if engagement_score >= 2500 {
        format!("High engagement rate ({:.1}%)", input.creator_engagement_rate)
    } else {
        "Potential cross-category match".to_string()
    };

    MatchScore {
        opportunity_fit_score,
        creator_quality_score,
        category_affinity,
        engagement_match: engagement_score,
        level_bonus,
        is_qualified,
        match_reason,
        estimated_deal_value,
    }
}
