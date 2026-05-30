// Template constants for notification emails
// These are used by the email service as fallback templates

pub const WAITLIST_WELCOME: &str = r#"<h2>Welcome to Valueskins!</h2><p>You're #{{position}} on the waitlist.</p><p>Share your referral link: {{referral_link}}</p>"#;
pub const OPPORTUNITY_MATCH: &str = r#"<h2>New Opportunity!</h2><p>{{brand}} posted "{{opportunity_title}}" with a reward of {{reward}}.</p>"#;
pub const DEAL_COMPLETED: &str = r#"<h2>Deal Complete!</h2><p>You earned ${{amount}} from {{brand}}.</p>"#;
pub const LEVEL_UP: &str = r#"<h2>Level Up!</h2><p>You've reached Level {{new_level}} - {{level_name}}!</p>"#;
pub const REFERRAL_REWARD: &str = r#"<h2>Referral Reward!</h2><p>You earned ${{amount}} from referring {{referred_name}}.</p>"#;
