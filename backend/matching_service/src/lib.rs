//! ValuSkin-Based Matching Service
//!
//! Core matching rule: creators and brands are matched ONLY if they share
//! the same ValuSkin (profession). A brand targeting "Software Engineer"
//! will only see creators who hold a Software Engineer ValuSkin, and vice versa.
//!
//! This creates a trust layer where both sides have verified domain identity,
//! unlike generic influencer marketplaces where matching is based on follower count alone.

pub mod models;
pub mod service;
pub mod handlers;
pub mod algorithm;
