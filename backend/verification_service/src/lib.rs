//! Verification Service
//!
//! Enterprise and employee verification system.
//! Multi-layer verification: domain, DNS, email, business registration, LinkedIn.
//!
//! Prevents impersonation of companies like Google, Nike, OpenAI.
//! Supports international business registration verification.

pub mod models;
pub mod service;
pub mod handlers;
pub mod domain_verification;
pub mod business_verification;
pub mod enterprise_verification;
