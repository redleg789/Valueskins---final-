//! Unified Creator Profile — aggregates data across all platforms into single view

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Single creator across all platforms they use
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedCreatorProfile {
    pub creator_id: i64, // ValueSkins internal ID
    pub name: String,
    pub bio: String,
    pub profile_picture: Option<String>,

    // Platform presence (empty if not on that platform)
    pub platforms: HashMap<String, PlatformPresence>, // key: "instagram", "youtube", "tiktok", "linkedin"

    // Aggregated stats (calculated across all platforms)
    pub aggregate_stats: AggregateStats,

    // Risk & trust scores (no external API calls)
    pub brand_safety_score: f64, // 0-100
    pub fraud_risk_score: f64, // 0-100 (0 = safe, 100 = high risk)
    pub authenticity_score: f64, // 0-100 (based on cross-platform consistency)
    pub reputation_score: f64, // 0-100 (based on deal history)

    // Derived insights (pure computation)
    pub creator_tier: CreatorTier,
    pub primary_niche: String,
    pub audience_demographics: AudienceDemographics,

    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformPresence {
    pub platform: String, // "instagram", "youtube", etc
    pub platform_id: String,
    pub username: String,
    pub follower_count: i64,
    pub following_count: i64,
    pub post_count: i64,
    pub engagement_rate: f64, // percentage
    pub avg_reach_per_post: i64,
    pub profile_picture_url: Option<String>,
    pub bio: Option<String>,
    pub website: Option<String>,
    pub is_verified: bool,
    pub last_synced: chrono::DateTime<chrono::Utc>,
}

/// Aggregated across all creator's platforms
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregateStats {
    pub total_followers: i64,
    pub total_following: i64,
    pub total_posts: i64,
    pub combined_monthly_reach: i64, // estimated from all platforms
    pub average_engagement_rate: f64, // weighted average
    pub most_active_platform: String,
    pub platform_count: usize,
    pub days_active: i32, // days since first platform join
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CreatorTier {
    Nano,      // 1K-10K followers
    Micro,     // 10K-100K
    MidTier,   // 100K-1M
    Macro,     // 1M-10M
    Mega,      // 10M+
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudienceDemographics {
    pub estimated_age_groups: HashMap<String, f64>, // "18-24": 0.35, "25-34": 0.40, etc
    pub estimated_gender_split: GenderSplit,
    pub top_countries: Vec<(String, f64)>, // [("US", 0.45), ("UK", 0.15)]
    pub inferred_interests: Vec<String>, // ["fashion", "beauty", "lifestyle"]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenderSplit {
    pub male: f64,
    pub female: f64,
    pub other: f64,
    pub unknown: f64,
}

impl UnifiedCreatorProfile {
    /// Calculate reputation score from deal history (no external calls)
    pub fn calculate_reputation_score(
        completed_deals: i32,
        avg_rating: f64,
        on_time_rate: f64,
        response_time_avg_hours: f64,
    ) -> f64 {
        // Weighted formula: 30% completion + 25% rating + 20% on-time + 15% responsiveness + 10% volume
        let completion_score = (completed_deals as f64 / 100.0).min(1.0) * 30.0; // capped at 30
        let rating_score = (avg_rating / 5.0) * 25.0; // 0-25
        let on_time_score = on_time_rate * 20.0; // 0-20
        let response_score = if response_time_avg_hours < 4.0 {
            15.0 // fast response gets full points
        } else if response_time_avg_hours < 24.0 {
            15.0 * (1.0 - (response_time_avg_hours - 4.0) / 20.0)
        } else {
            0.0
        };
        let volume_bonus = ((completed_deals as f64 / 50.0).min(1.0)) * 10.0; // 0-10

        completion_score + rating_score + on_time_score + response_score + volume_bonus
    }

    /// Calculate brand safety score (no external calls, pure heuristics)
    pub fn calculate_brand_safety_score(
        follower_count: i64,
        engagement_rate: f64,
        account_age_days: i32,
        platform_count: usize,
        is_verified: bool,
    ) -> f64 {
        let mut score: f64 = 50.0; // baseline

        // Follower authenticity signals
        if follower_count > 10_000 && follower_count < 10_000_000 {
            score += 15.0; // sweet spot (not suspiciously small/large)
        }

        // Engagement rate signals
        if engagement_rate > 2.0 && engagement_rate < 10.0 {
            score += 15.0; // realistic engagement
        }
        if engagement_rate > 10.0 {
            score -= 10.0; // suspiciously high (bot activity?)
        }

        // Account age signals
        if account_age_days > 365 {
            score += 10.0; // established account
        }
        if account_age_days > 1825 {
            score += 5.0; // very established
        }

        // Multi-platform presence signals authenticity
        if platform_count > 1 {
            score += 10.0;
        }
        if platform_count > 2 {
            score += 5.0;
        }

        // Verification badge
        if is_verified {
            score += 15.0;
        }

        score.min(100.0).max(0.0)
    }

    /// Calculate fraud risk score (opposite of brand safety)
    pub fn calculate_fraud_risk_score(
        follower_count: i64,
        engagement_rate: f64,
        account_age_days: i32,
        platform_count: usize,
        post_consistency_score: f64, // 0-1: how consistent their posting is
    ) -> f64 {
        // Red flags for bot/fake accounts
        let mut risk: f64 = 0.0;

        // Follower count red flags
        if follower_count < 100 || follower_count > 100_000_000 {
            risk += 20.0;
        }
        if follower_count % 10_000 == 0 || follower_count % 50_000 == 0 {
            risk += 10.0; // suspiciously round numbers
        }

        // Engagement red flags
        if engagement_rate > 50.0 {
            risk += 30.0; // impossibly high
        }
        if engagement_rate < 0.1 {
            risk += 15.0; // dead account
        }

        // Account age red flags
        if account_age_days < 30 {
            risk += 25.0;
        }
        if account_age_days < 180 {
            risk += 10.0;
        }

        // Multi-platform presence (low risk if present)
        if platform_count == 1 {
            risk += 5.0;
        }

        // Posting consistency (bots post at regular intervals)
        if post_consistency_score > 0.95 {
            risk += 15.0; // too perfect
        }

        risk.min(100.0).max(0.0)
    }

    /// Calculate authenticity score (cross-platform consistency)
    pub fn calculate_authenticity_score(
        platforms: &HashMap<String, PlatformPresence>,
        follower_count_variance: f64, // 0-1: how different followers are across platforms
    ) -> f64 {
        let mut score: f64 = 50.0; // baseline

        // More platforms = more authentic (harder to fake across multiple)
        match platforms.len() {
            1 => score -= 15.0,
            2 => score += 10.0,
            3 => score += 20.0,
            4 => score += 25.0,
            _ => score += 25.0,
        }

        // Username consistency across platforms (manual check in UI, but heuristic here)
        // If follower counts are dramatically different, suspicious
        if follower_count_variance < 0.2 {
            score += 15.0; // consistent presence
        } else if follower_count_variance > 0.7 {
            score -= 10.0; // inconsistent presence
        }

        // Bio consistency
        let bios: Vec<&str> = platforms.iter().filter_map(|(_, p)| p.bio.as_deref()).collect();
        if bios.len() >= 2 {
            // Count how many bios mention same keywords/themes
            let bio_str = bios.join(" ");
            let unique_words = bio_str.split_whitespace().count();
            let repeated_words = bio_str.matches(&bio_str).count();
            if repeated_words > unique_words / 2 {
                score += 10.0; // consistent messaging
            }
        }

        score.min(100.0).max(0.0)
    }

    /// Infer creator tier from followers
    pub fn infer_tier(total_followers: i64) -> CreatorTier {
        match total_followers {
            0..=10_000 => CreatorTier::Nano,
            10_001..=100_000 => CreatorTier::Micro,
            100_001..=1_000_000 => CreatorTier::MidTier,
            1_000_001..=10_000_000 => CreatorTier::Macro,
            _ => CreatorTier::Mega,
        }
    }

    /// Infer niche from engagement patterns (simple heuristic)
    pub fn infer_niche(
        platform_usernames: &[String],
        bios: &[String],
    ) -> String {
        let combined = format!("{} {}", platform_usernames.join(" "), bios.join(" ")).to_lowercase();

        let niches = [
            ("fashion", vec!["fashion", "style", "outfit", "designer", "clothing", "boutique"]),
            ("beauty", vec!["beauty", "makeup", "skincare", "cosmetics", "glam", "lashes"]),
            ("fitness", vec!["fitness", "gym", "workout", "trainer", "yoga", "health", "wellness"]),
            ("food", vec!["food", "recipe", "cook", "chef", "foodie", "cafe", "restaurant"]),
            ("travel", vec!["travel", "adventure", "explore", "wanderlust", "tourism", "destination"]),
            ("tech", vec!["tech", "startup", "developer", "ai", "coding", "software", "innovation"]),
            ("lifestyle", vec!["lifestyle", "daily", "vlog", "content creator", "influencer"]),
            ("gaming", vec!["gaming", "twitch", "streamer", "esports", "gamer", "fps", "rpg"]),
            ("music", vec!["music", "artist", "producer", "singer", "dj", "musician", "sound"]),
            ("education", vec!["education", "learning", "teach", "course", "school", "knowledge"]),
        ];

        for (niche, keywords) in &niches {
            let matches = keywords.iter().filter(|k| combined.contains(*k)).count();
            if matches >= 2 {
                return niche.to_string();
            }
        }

        "general".to_string()
    }

    /// Estimate audience demographics from username patterns (simple heuristic)
    pub fn estimate_demographics(follower_count: i64, engagement_rate: f64) -> AudienceDemographics {
        // These are heuristics; in production, brands would provide actual data
        let (age_dist, gender_dist) = match follower_count {
            0..=50_000 => {
                // Smaller creators often skew younger female
                (
                    vec![("13-17", 0.15), ("18-24", 0.35), ("25-34", 0.25), ("35-44", 0.15), ("45+", 0.10)],
                    GenderSplit { male: 0.35, female: 0.60, other: 0.03, unknown: 0.02 },
                )
            }
            50_001..=500_000 => {
                // Mid-tier more balanced
                (
                    vec![("13-17", 0.10), ("18-24", 0.25), ("25-34", 0.35), ("35-44", 0.20), ("45+", 0.10)],
                    GenderSplit { male: 0.45, female: 0.50, other: 0.03, unknown: 0.02 },
                )
            }
            _ => {
                // Large creators skew older
                (
                    vec![("13-17", 0.05), ("18-24", 0.15), ("25-34", 0.30), ("35-44", 0.30), ("45+", 0.20)],
                    GenderSplit { male: 0.50, female: 0.45, other: 0.03, unknown: 0.02 },
                )
            }
        };

        let mut age_groups = HashMap::new();
        for (age, pct) in age_dist {
            age_groups.insert(age.to_string(), pct);
        }

        AudienceDemographics {
            estimated_age_groups: age_groups,
            estimated_gender_split: gender_dist,
            top_countries: vec![("US".to_string(), 0.40), ("UK".to_string(), 0.10), ("CA".to_string(), 0.08), ("AU".to_string(), 0.07)],
            inferred_interests: vec!["content creator".to_string(), "social media".to_string()],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reputation_score() {
        let score = UnifiedCreatorProfile::calculate_reputation_score(50, 4.8, 0.95, 2.0);
        assert!(score > 70.0 && score < 100.0);
    }

    #[test]
    fn test_brand_safety_score() {
        let score = UnifiedCreatorProfile::calculate_brand_safety_score(100_000, 5.0, 500, 2, true);
        assert!(score > 60.0);
    }

    #[test]
    fn test_fraud_risk_score() {
        let score = UnifiedCreatorProfile::calculate_fraud_risk_score(100_000, 5.0, 500, 2, 0.5);
        assert!(score < 30.0);
    }

    #[test]
    fn test_tier_inference() {
        assert_eq!(UnifiedCreatorProfile::infer_tier(5_000), CreatorTier::Nano);
        assert_eq!(UnifiedCreatorProfile::infer_tier(50_000), CreatorTier::Micro);
        assert_eq!(UnifiedCreatorProfile::infer_tier(500_000), CreatorTier::MidTier);
    }

    #[test]
    fn test_niche_inference() {
        let usernames = vec!["fitnessguru".to_string()];
        let bios = vec!["yoga and workout enthusiast".to_string()];
        let niche = UnifiedCreatorProfile::infer_niche(&usernames, &bios);
        assert_eq!(niche, "fitness");
    }
}
