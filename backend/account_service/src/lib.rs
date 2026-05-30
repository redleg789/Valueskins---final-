//! Account Service — Universal Account Management
//!
//! One account for all of ValueSkins. Users sign up once.
//! Accounts are not tied to ValueSkins. Modules (valueskin, host,
//! brand, explorer, community) are optional attachments.
//!
//! This service handles:
//! - Account CRUD (get_me, update_me)
//! - Module management (activate, deactivate, list)
//! - Preference/onboarding management
//! - Permission resolution (module → permissions)
//! - Session management (list, revoke)

pub mod models;
pub mod service;
pub mod handlers;
pub mod errors;
