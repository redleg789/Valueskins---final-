//! User Settings Service
//!
//! Manages per-user preferences stored in the `user_settings` table.
//! Decoupled from the `users` table for extensibility — new settings
//! can be added without altering the hot users table.
//!
//! Settings include:
//! - willing_to_barter: open to non-monetary collaborations
//! - energy_state: availability signal (available/limited/burnout/pause)
//! - price_band: public pricing signal without revealing exact rate
//! - auto_escalation: auto-escalate unresponsive deals
//! - notifications_enabled: push/email notification preference
//! - profile_visibility: public/private/connections_only

pub mod models;
pub mod service;
pub mod handlers;
