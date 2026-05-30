//! Marketplace Service
//! 
//! BLOCKER: Revenue compounding and repeat spend mechanics
//!
//! Transaction-based marketplace connecting brands with creators.
//! Platform earns take-rate on every deal.

pub mod handlers;
pub mod models;
pub mod service;
pub mod reputation_service;
pub mod fraud_service;
pub mod fraud_detection;
pub mod underwriting_service;
pub mod dispute_service;
pub mod barter_service;
pub mod gdpr_service;
pub mod brand_verification_service;
pub mod completeness_service;
pub mod payout_service;
pub mod interest_service;
pub mod interest_handlers;
pub mod opportunity_source;
pub mod revenue_protection;
pub mod revenue_protection_handlers;
