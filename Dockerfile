# Build stage
FROM rust:1.75 as builder

WORKDIR /app

# Copy workspace
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/api_gateway ./api_gateway
COPY backend/shared ./shared
COPY backend/auth_service ./auth_service
COPY backend/persona_service ./persona_service
COPY backend/social_service ./social_service
COPY backend/analytics_service ./analytics_service
COPY backend/recommendation_service ./recommendation_service
COPY backend/ai_service ./ai_service
COPY backend/notification_service ./notification_service
COPY backend/referral_service ./referral_service
COPY backend/marketplace_service ./marketplace_service
COPY backend/waitlist_service ./waitlist_service
COPY backend/brand_api ./brand_api
COPY backend/communities_service ./communities_service
COPY backend/credential_service ./credential_service
COPY backend/matching_service ./matching_service
COPY backend/settings_service ./settings_service
COPY backend/linkedin_service ./linkedin_service
COPY backend/platform_service ./platform_service
COPY backend/pricing_service ./pricing_service
COPY backend/credit_service ./credit_service
COPY backend/contract_service ./contract_service
COPY backend/reputation_service ./reputation_service
COPY backend/migrations ./migrations

# Build
RUN cargo build --release -p api_gateway

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/api_gateway /app/api_gateway

WORKDIR /app

EXPOSE 8080

CMD ["./api_gateway"]
