//! Tag validation, normalization, and anti-spam utilities for the search system.
//!
//! This module provides:
//! - Tag normalization (slug generation, cleanup)
//! - Banned term detection
//! - Profanity filtering
//! - Tag quality scoring
//! - Autocomplete suggestion formatting

use std::collections::HashSet;
use once_cell::sync::Lazy;
use regex::Regex;

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

pub const MAX_TAGS_PER_USER: usize = 15;
pub const MIN_TAG_LENGTH: usize = 2;
pub const MAX_TAG_LENGTH: usize = 50;
pub const MAX_CUSTOM_TAGS_PER_USER: usize = 5;

// ──────────────────────────────────────────────────────────────────────────
// Pre-compiled regex patterns
// ──────────────────────────────────────────────────────────────────────────

static SLUG_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[^a-z0-9-]").unwrap());
static MULTI_DASH_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"-{2,}").unwrap());
static LEADING_TRAILING_DASH: Lazy<Regex> = Lazy::new(|| Regex::new(r"^-|-$").unwrap());
static UNICODE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[^\x00-\x7F]").unwrap());

// ──────────────────────────────────────────────────────────────────────────
// Banned terms list (in-memory cache, synced from DB on startup)
// ──────────────────────────────────────────────────────────────────────────

static BANNED_TERMS: Lazy<HashSet<String>> = Lazy::new(|| {
    [
        "viral", "famous", "millionaire", "billionaire",
        "elon musk", "ceo of", "verified", "official",
        "admin", "moderator", "system", "root",
    ]
    .iter()
    .map(|&s| s.to_string())
    .collect()
});

/// Tag validation result
#[derive(Debug, Clone)]
pub struct TagValidationResult {
    pub is_valid: bool,
    pub normalized_tag: String,
    pub errors: Vec<String>,
}

/// Normalize a raw user input into a tag slug.
///
/// Steps:
/// 1. Convert to lowercase
/// 2. Strip unicode/non-ASCII characters
/// 3. Replace spaces and special chars with hyphens
/// 4. Collapse multiple hyphens
/// 5. Strip leading/trailing hyphens
/// 6. Validate length constraints
pub fn normalize_tag(raw: &str) -> TagValidationResult {
    let mut errors = Vec::new();
    let trimmed = raw.trim();

    // Length checks
    if trimmed.is_empty() {
        return TagValidationResult {
            is_valid: false,
            normalized_tag: String::new(),
            errors: vec!["Tag cannot be empty".to_string()],
        };
    }

    if trimmed.len() < MIN_TAG_LENGTH {
        errors.push(format!("Tag must be at least {} characters", MIN_TAG_LENGTH));
    }

    if trimmed.len() > MAX_TAG_LENGTH {
        errors.push(format!("Tag must be at most {} characters", MAX_TAG_LENGTH));
    }

    // Normalize: lowercase, strip unicode, replace non-alphanumeric with hyphens
    let lower = trimmed.to_lowercase();
    let ascii = UNICODE_RE.replace_all(&lower, "").to_string();
    let with_hyphens = ascii.replace(' ', "-").replace('_', "-");
    let slug = SLUG_RE.replace_all(&with_hyphens, "-").to_string();
    let slug = MULTI_DASH_RE.replace_all(&slug, "-").to_string();
    let slug = LEADING_TRAILING_DASH.replace_all(&slug, "").to_string();

    if slug.is_empty() {
        errors.push("Tag contains no valid characters".to_string());
        return TagValidationResult {
            is_valid: false,
            normalized_tag: String::new(),
            errors,
        };
    }

    TagValidationResult {
        is_valid: errors.is_empty(),
        normalized_tag: slug,
        errors,
    }
}

/// Check if a tag is banned.
/// Checks against the banned terms list.
pub fn is_banned_term(tag: &str) -> bool {
    let lower = tag.to_lowercase();
    BANNED_TERMS.contains(&lower)
        || BANNED_TERMS.iter().any(|banned| lower.contains(banned.as_str()))
}

/// Check for profanity in a tag (basic word-level check).
/// In production, this would use a comprehensive profanity list or external API.
pub fn contains_profanity(tag: &str) -> bool {
    // Placeholder — replace with comprehensive profanity list
    // or external profanity detection service
    let lower = tag.to_lowercase();
    // These are example patterns; replace with actual profanity list
    let profane_patterns = [
        "f***", "s***", "a****", "b***", "d***",
    ];
    profane_patterns.iter().any(|p| lower.contains(*p))
}

/// Validate a complete tag (all checks combined).
pub fn validate_tag(raw: &str) -> TagValidationResult {
    let mut result = normalize_tag(raw);

    if !result.is_valid {
        return result;
    }

    // Check banned terms
    if is_banned_term(&result.normalized_tag) {
        result.is_valid = false;
        result.errors.push("This tag is not allowed".to_string());
        return result;
    }

    // Check profanity
    if contains_profanity(&result.normalized_tag) {
        result.is_valid = false;
        result.errors.push("This tag contains inappropriate content".to_string());
        return result;
    }

    result
}

/// Validate a batch of tags (returns valid ones + errors).
pub fn validate_tags(raw_tags: &[String]) -> (Vec<String>, Vec<(String, Vec<String>)>) {
    let mut valid = Vec::new();
    let mut invalid = Vec::new();

    // Deduplicate
    let seen: HashSet<String> = raw_tags.iter()
        .map(|t| t.to_lowercase())
        .collect();

    if seen.len() > MAX_TAGS_PER_USER {
        // Too many unique tags
        for raw in raw_tags.iter().take(MAX_TAGS_PER_USER) {
            let result = validate_tag(raw);
            if result.is_valid {
                valid.push(result.normalized_tag);
            } else {
                invalid.push((raw.clone(), result.errors));
            }
        }
    } else {
        for raw in raw_tags {
            let result = validate_tag(raw);
            if result.is_valid {
                valid.push(result.normalized_tag);
            } else {
                invalid.push((raw.clone(), result.errors));
            }
        }
    }

    (valid, invalid)
}

/// Generate a tag slug from canonical name.
/// Used when creating new dictionary entries.
pub fn slugify(name: &str) -> String {
    let lower = name.to_lowercase();
    let with_hyphens = lower.replace(' ', "-");
    let slug = SLUG_RE.replace_all(&with_hyphens, "-").to_string();
    let slug = MULTI_DASH_RE.replace_all(&slug, "-").to_string();
    LEADING_TRAILING_DASH.replace_all(&slug, "").to_string()
}

/// Calculate a simple quality score for a tag based on usage metrics.
/// Score 0-100 based on usage frequency, selection rate, and report count.
pub fn calculate_tag_quality_score(
    usage_count: i32,
    selection_count: i32,
    search_appearances: i32,
    report_count: i32,
) -> f64 {
    if search_appearances == 0 {
        return 0.0;
    }

    let selection_rate = selection_count as f64 / search_appearances as f64;
    let usage_bonus = (usage_count as f64).min(50.0);
    let selection_bonus = (selection_rate * 30.0).min(30.0);
    let report_penalty = (report_count as f64 * 10.0).min(40.0);

    (usage_bonus + selection_bonus + 20.0 - report_penalty)
        .max(0.0)
        .min(100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_basic() {
        let result = normalize_tag("Electric Guitar");
        assert!(result.is_valid);
        assert_eq!(result.normalized_tag, "electric-guitar");
    }

    #[test]
    fn test_normalize_special_chars() {
        let result = normalize_tag("C++ Developer");
        assert!(result.is_valid);
        assert_eq!(result.normalized_tag, "c-developer");
    }

    #[test]
    fn test_normalize_unicode() {
        let result = normalize_tag("Caf\u{00e9} Owner");
        assert!(result.is_valid);
        // Unicode stripped, spaces become hyphens
        assert_eq!(result.normalized_tag, "caf-owner");
    }

    #[test]
    fn test_normalize_empty() {
        let result = normalize_tag("");
        assert!(!result.is_valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_normalize_too_short() {
        let result = normalize_tag("a");
        assert!(!result.is_valid);
    }

    #[test]
    fn test_banned_terms() {
        assert!(is_banned_term("viral"));
        assert!(is_banned_term("I went viral"));
        assert!(is_banned_term("Elon Musk"));
        assert!(!is_banned_term("guitar"));
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Electric Guitar"), "electric-guitar");
        assert_eq!(slugify("AI/ML"), "aiml");
        assert_eq!(slugify("  Test  "), "test");
    }

    #[test]
    fn test_validate_batch() {
        let tags = vec![
            "Electric Guitar".to_string(),
            "viral".to_string(),
            "Rock".to_string(),
        ];
        let (valid, invalid) = validate_tags(&tags);
        assert_eq!(valid.len(), 2);
        assert!(valid.contains(&"electric-guitar".to_string()));
        assert!(valid.contains(&"rock".to_string()));
        assert_eq!(invalid.len(), 1);
        assert_eq!(invalid[0].0, "viral");
    }

    #[test]
    fn test_quality_score() {
        // High quality: lots of usage, good selection, no reports
        let score = calculate_tag_quality_score(100, 80, 100, 0);
        assert!(score >= 70.0);

        // Low quality: lots of reports
        let score = calculate_tag_quality_score(100, 80, 100, 10);
        assert!(score <= 50.0);
    }
}
