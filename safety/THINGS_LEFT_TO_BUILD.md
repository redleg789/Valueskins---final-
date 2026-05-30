# Things Left to Build — Trust & Verification System

## Immediate (Build Phase)

- [ ] **Seed migration** — `20240402000000_trust_verification_seed.sql` with countries, document templates, region configs, default trust tiers, badge definitions
- [x] **Moderation service crate** — queue management, report intake, action engine (suspend/ban/warn/restrict), appeal workflow, escalation, moderator audit log
- [ ] **Periodic background workers** — wire up trust score recalculation and risk scanning tasks in `api_gateway/src/main.rs`
- [ ] **Trust enrichment on profile** — `/me/trust` endpoint integration so user profiles show trust score/tier/badges
- [ ] **Real DNS verification** — replace mock `trust-dns-resolver` with async lookup in `verification_service`
- [ ] **Integration tests** — all 18 event handlers in outbox_worker (happy path + failure modes)

## Medium Priority

- [ ] **Identity document provider abstraction** — implement Stripe Identity / Persona / Onfido providers (currently MockVerificationProvider)
- [ ] **KYC liveness check** — selfie + liveness detection integration
- [ ] **Age verification expiry** — cron job to expire ADULT_ACTIVE states after configurable period
- [ ] **Guardian age-up automation** — scheduled check for minors approaching 18, auto-initiate transfer
- [ ] **Trust score decay** — inactivity penalty recalculation on a schedule
- [ ] **Badge revocation on trust drop** — auto-revoke badges when score falls below threshold
- [ ] **Rate limit on verification endpoints** — prevent abuse of document upload / KYC init
- [ ] **Admin dashboard APIs** — moderation queue, manual review case management, investigation tools
- [ ] **Audit log viewer** — expose trust_score_events and risk_events for compliance/legal

## Low Priority / Polish

- [ ] **Webhook integration** — notify external compliance systems on verification state changes
- [ ] **Analytics events** — pipe trust/risk events into existing analytics_service for product metrics
- [ ] **Caching** — Redis cache for trust scores (reduce DB load on profile views)
- [ ] **Rate limit escalation** — graduated limits based on risk_level (freeze at high risk)
- [ ] **Performance benchmarks** — load test trust score calculation at 1M+ users
- [ ] **Documentation** — API reference for all new endpoints, sequence diagrams for complex flows
- [ ] **Monitoring** — Datadog/Prometheus metrics for verification funnel conversion, risk event rates
- [ ] **Localization** — document verification region-specific rules (different IDs per country)
