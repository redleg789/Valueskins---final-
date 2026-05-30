//! Brand API Service
//! 
//! BLOCKER ADDRESSED: Ecosystem and third-party dependency potential
//! 
//! This service provides a PUBLIC API for brands to:
//! - Verify creator levels and credentials
//! - Query creator profiles by profession
//! - Validate opportunities and applications
//! - Generate embeddable verification badges
//! 
//! Creates external dependency on Valueskins as the source of truth
//! for creator verification.

pub mod handlers;
pub mod models;
pub mod service;
pub mod auth;
