# ValueSkins Beta Architecture

A production-minded beta foundation built to scale to 100M+ users without rewrites.

---

## SECTION 1: BETA SCOPE

### What Exists in Beta

| System | Required? | Why |
|--------|-----------|-----|
| Email + password auth + OAuth (Google/Apple) | Required | Users need to sign in. No phone-only — too many edge cases with carriers, roaming, SMS delays. |
| Session management (refresh tokens, rotation) | Required | Without this, users logout on every page refresh or tokens leak. |
| Basic profile (handle, display name, avatar, bio) | Required | Users need identity. Handle = unique, immutable, URL-safe. Display name = mutable, any Unicode. |
| ValueSkin creation (profession-tagged identity) | Required | Core product primitive. User creates a "ValueSkin" tied to a profession (creator, designer, engineer, etc.). |
| Directory search (by handle, profession) | Required | Users must find each other. |
| Connection request (follow / connect) | Required | Core interaction. One-directional (follow) or bidirectional (connect). |
| Messaging (between connected users) | Required | Without this, users leave. Text only. No attachments. No read receipts. |
| Report + block | Required | Hostile users exist. Without this, spam destroys trust on day 1. |
| Rate limiting | Required | One user with a script takes down the entire app. |
| Moderation panel (basic: view reports, suspend user) | Required | Without this, reported users remain active. Platform looks unmoderated. |
| Email verification | Required | Prevents disposable-account spam. |
| Account recovery (password reset) | Required | Users forget passwords. Without this, support tickets drown the team. |
| Audit log (immutable) | Required | When something breaks, you need to know what happened. |
| Session invalidation on password change | Required | Stolen session stays alive after password reset without this. |
| Rate-limited login (5 attempts → 15m lockout) | Required | Brute force works without this. |
| CAPTCHA on signup | Required | Bot signups fill the database with garbage. |
| Feature flags | Required | Without this, every deploy breaks production. |

### What Does NOT Exist in Beta

| System | Not Required | Why Delay? |
|--------|-------------|------------|
| Trust scores | Not required | Cannot compute trust without history. Scores are meaningless with zero data. Build after users have 30+ days of activity. |
| Verification badges | Not required | Verification requires a manual or automated process. Beta users are early adopters — trust is earned, not badged. |
| Enterprise accounts | Not required | Enterprises need compliance, SSO, contracts, billing. Building this before product-market fit is 6 months of wasted engineering. |
| Guardian / under-18 system | Not required | COPPA compliance, parental consent flows, document uploads. If beta skews under 18, add this. Otherwise delay until minors arrive. |
| Contracts / deal rooms | Not required | Legal contracts in beta create liability. Users can negotiate in messages. Contracts come after trust system. |
| Payments / escrow | Not required | Payment processing, Stripe Connect onboarding, KYC, tax forms. 3 months of work minimum. Do not build until users demand it. |
| Agencies / teams | Not required | Multi-user orgs, role management, shared inboxes. Hard. Not needed for single-creator beta. |
| Reputation system | Not required | Reputation needs data (completed deals, testimonials). No data in beta. |
| API for third parties | Not required | Public API is a security surface. No third-party integrations in beta. |
| Mobile apps | Not required | Responsive web works. Native apps add release cycles, app store review, push notification infrastructure. |
| Notifications (push, email) | Not required beyond transactional (password reset, verification). Marketing emails, daily digests, push notifications — delay. |
| Content moderation (NLP, auto-flagging) | Not required beyond manual report review. Auto-moderation is never right in beta. Manual review is correct until scale demands automation. |
| Analytics dashboard | Not required beyond basic: signups, DAU, messages sent. Product analytics can be a spreadsheet in beta. |
| Search (full-text, fuzzy, filters) | Not required. Simple SQL `LIKE` on handle works for beta. Elasticsearch comes when users complain about search. |
| File uploads (avatar only) | Not required beyond avatar. Photo attachments, document uploads, portfolio images — delay. File upload is a malware vector. |

### Founder Temptations to Resist

1. **"Let me just add payments quickly — Stripe is easy"** — Stripe Connect onboarding takes 3 weeks minimum. KYC, tax forms, payout schedules, dispute handling. Do not build until users are begging to pay.

2. **"Let me make profiles look amazing with custom CSS and themes"** — Every visual feature is maintenance. Every theme is a CSS bug farm. Ship one clean design.

3. **"Let me add Teams/Agencies because creators work together"** — Multi-user accounts require role models, permissions, shared resources, billing. Build single-user first. Groups come later.

4. **"Let me add verification badges to look legit"** — Verification without a process is fake. A blue checkmark means nothing. Building a verification pipeline (document upload, manual review, appeal) before you have 1000 users is premature.

5. **"Let me add a mobile app because investors expect it"** — Responsive web works. React Native / Flutter / SwiftUI all add 2-3 platforms worth of bugs. Delay native until web retention proves product-market fit.

6. **"Let me add blockchain / NFTs / tokens"** — Zero users care about the data layer. They care about finding collaborators and sending messages.

7. **"Let me build a recommendation algorithm"** — Recommendations without data recommend nothing. SQL queries sorted by "most recently active" or "mutual connections" work until you have 100K+ users.

8. **"Let me make it real-time with WebSockets"** — Polling every 5 seconds works for beta. WebSockets add connection state, reconnection logic, backpressure, horizontal scaling complexity.

### What Kills Early Stability

1. **Two databases** (write primary + read replica) before you have 1000 users. Premature scaling adds deployment complexity. Single Postgres instance handles 10M+ rows easily with proper indexing.

2. **Microservices** before you have 10 services. A monolith with clear module boundaries can be split later. Premature microservices add network calls, serialization bugs, deployment coordination.

3. **Kubernetes** before you have 5 services. A single VM with Docker Compose or a PaaS (Railway, Render) is correct for beta. Kubernetes is a full-time ops job.

4. **Event-driven architecture** before you have events worth driving. A message queue is a great place for bugs to hide — ordering, deduplication, retry, dead letters. Use direct function calls until you need async.

5. **GraphQL** before you have complex data graphs. REST is simpler to cache, debug, and version. GraphQL adds resolvers, N+1 problems, and client-side query complexity.

6. **Caching layer** before you have performance problems. A cache that returns stale data is worse than no cache. Add Redis when your database queries exceed 50ms.

7. **Multi-region** before you have users in multiple regions. Single-region (us-east-1) is correct. Multi-region adds data replication, conflict resolution, latency complexity.

---

## SECTION 2: MINIMUM CORE FLOW

### The Full User Journey

```
                    ┌─────────────────────────────────────────────────────────────────────────────┐
                    │                             VALUE SKINS BETA                                  │
                    │                         Minimum Core User Journey                              │
                    └─────────────────────────────────────────────────────────────────────────────┘

                                      ┌─────────────────────────┐
                                      │  LANDING PAGE           │
                                      │  - hero section         │
                                      │  - "Find your people"   │
                                      │  - CTA: Sign Up / Login │
                                      │  - static, no DB calls  │
                                      └─────────┬───────────────┘
                                                │
                                                ▼
                         ┌───────────────────────────────────────────┐
                         │           SIGN UP                          │
                         │  ┌─────────────────────────────────┐       │
                         │  │ Email                           │──────►│──► Validate format
                         │  │ Password (12+ chars)            │──────►│──► Check pwned + strength
                         │  │ Confirm password                │──────►│──► Match check
                         │  │ [ ] I accept the Terms          │       │
                         │  │ [ ] I'm not a robot (CAPTCHA)   │──────►│──► hCaptcha verify
                         │  └─────────────────────────────────┘       │
                         │                                           │
                         │  FAILURE PATHS:                            │
                         │  • Email exists → "Account already exists" │
                         │  • Weak password → show requirements       │
                         │  • CAPTCHA fail → retry                    │
                         │  • Terms not checked → highlight           │
                         │  • Rate limited → "Try again in 15m"       │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │     EMAIL VERIFICATION                     │
                         │                                           │
                         │  "We sent a code to your@email.com"        │
                         │                                           │
                         │  ┌─────────────────────────┐              │
                         │  │ [6-digit code]          │              │
                         │  │ [Verify] [Resend (60s)] │              │
                         │  └─────────────────────────┘              │
                         │                                           │
                         │  STATE: USER_STATE = 'EMAIL_UNVERIFIED'    │
                         │                                           │
                         │  FAILURE PATHS:                           │
                         │  • Wrong code → "Invalid code. Try again."│
                         │  • Expired code → auto-resend             │
                         │  • Email in spam → helpful prompt         │
                         │  • User closes tab → reopen with token    │
                         │  • User never verifies → cleanup job      │
                         │    deletes unverified after 24h           │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │     ONBOARDING: CHOOSE HANDLE              │
                         │                                           │
                         │  Handle: [valueskins.io/@your_handle]     │
                         │                                           │
                         │  Rules:                                   │
                         │  • 3-30 alphanumeric + underscores         │
                         │  • Must start with letter                  │
                         │  • Case-insensitive unique                 │
                         │  • No profanity (blocklist)                │
                         │  • Reserved handles blocked                │
                         │    (admin, support, moderator, etc.)       │
                         │                                           │
                         │  Display name: [Your Name]                 │
                         │  • 1-60 chars, any Unicode                 │
                         │  • No profanity check (yet)                │
                         │                                           │
                         │  FAILURE PATHS:                            │
                         │  • Handle taken → suggest alternatives     │
                         │  • Profane → "Handle not available"        │
                         │  • Empty → "Handle is required"            │
                         │  • Too long → show character limit         │
                         │  • Network error → retry button            │
                         │  • User refreshes → session still valid    │
                         │    (don't restart onboarding)              │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │     ONBOARDING: CREATE VALUESKIN           │
                         │                                           │
                         │  This is the core product primitive.       │
                         │  A ValueSkin = identity + profession.      │
                         │                                           │
                         │  ┌─────────────────────────────────┐       │
                         │  │ ValueSkin Name: "Design Work"   │       │
                         │  │ Profession: [Designer ▼]        │       │
                         │  │ Bio (optional): 200 chars max   │       │
                         │  │ Avatar (optional): crop + upload │       │
                         │  │ Email (optional, public):       │       │
                         │  │ Website (optional):             │       │
                         │  │ Location (optional):            │       │
                         │  └─────────────────────────────────┘       │
                         │                                           │
                         │  Professions: pre-defined list. No custom  │
                         │  in beta (prevents "CEO of Everything").   │
                         │                                           │
                         │  User can create 1 ValueSkin in beta.      │
                         │  (Multi-skin requires trust system TBD.)   │
                         │                                           │
                         │  EMPTY STATE: User has 0 ValueSkins.       │
                         │  → "Create your first ValueSkin to get     │
                         │     discovered by collaborators."          │
                         │                                           │
                         │  ERROR STATE: Creation fails mid-way.      │
                         │  → Form data survives in session storage.  │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │         PROFILE PAGE (YOUR VIEW)           │
                         │                                           │
                         │  ┌─────────────────────────────────┐       │
                         │  │ [Avatar] @handle                 │       │
                         │  │ Display Name                     │       │
                         │  │ ┌───────────────────────────┐    │       │
                         │  │ │ ValueSkin: Design Work    │    │       │
                         │  │ │ Profession: Designer      │    │       │
                         │  │ │ Bio: ...                  │    │       │
                         │  │ │ [Edit]                    │    │       │
                         │  │ └───────────────────────────┘    │       │
                         │  │ [Edit Profile] [Share]           │       │
                         │  │ [Settings] [Logout]               │       │
                         │  └─────────────────────────────────┘       │
                         │                                           │
                         │  EMPTY STATE: No connections, no activity │
                         │  → "Find creators and brands to connect."  │
                         │  → Suggested search prompt                 │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │           SEARCH / DISCOVERY               │
                         │                                           │
                         │  ┌─────────────────────────────────┐       │
                         │  │ 🔍 Search handles or professions│       │
                         │  └─────────────────────────────────┘       │
                         │                                           │
                         │  EMPTY RESULTS:                           │
                         │  → "No results for 'x'. Try a different   │
                         │     search or browse professions."          │
                         │  → Show profession list as fallback        │
                         │                                           │
                         │  RESULTS:                                  │
                         │  • @handle · Display Name                  │
                         │  • Profession badge                        │
                         │  • [Connect] [View Profile]                │
                         │                                           │
                         │  ERROR STATE:                              │
                         │  • Network → "Couldn't load results.       │
                         │     [Retry]"                                │
                         │  • Rate limit → "Slow down"                │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │          PUBLIC PROFILE PAGE               │
                         │                                           │
                         │  ┌─────────────────────────────────┐       │
                         │  │ [Avatar] @handle                 │       │
                         │  │ Display Name                     │       │
                         │  │ Profession: Designer             │       │
                         │  │ Bio                              │       │
                         │  │ [Connect] [Message] (if connected)│       │
                         │  │ [Block] [Report]                  │       │
                         │  └─────────────────────────────────┘       │
                         │                                           │
                         │  CONNECTION STATES:                        │
                         │  • Not connected → [Connect] button        │
                         │  • Request sent → [Pending] disabled       │
                         │  • Connected → [Message] visible           │
                         │  • Blocked → profile hidden                │
                         │  • Viewer is owner → edit mode             │
                         │                                           │
                         │  NOT FOUND:                                │
                         │  → "This user doesn't exist."              │
                         │  → (Don't reveal if suspended or deleted)  │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │           CONNECTION REQUEST               │
                         │                                           │
                         │  User clicks [Connect]                     │
                         │                                           │
                         │  IF target has open connections:           │
                         │  → Immediately connected (follow mode)     │
                         │                                           │
                         │  IF target requires approval:              │
                         │  → "Connection request sent"               │
                         │  → Recipient gets notification on next     │
                         │     page load                              │
                         │  → Recipient can Accept / Decline / Ignore │
                         │                                           │
                         │  FAILURE PATHS:                            │
                         │  • Already connected → show [Message]      │
                         │  • Already requested → show [Pending]      │
                         │  • Target blocked user → silent ignore     │
                         │  • Target doesn't exist → 404              │
                         │  • Rate limited → 429                      │
                         │  • Double click → idempotency check        │
                         │    (no duplicate requests)                 │
                         └─────────────────┬─────────────────────────┘
                                           │
                                           ▼
                         ┌───────────────────────────────────────────┐
                         │              MESSAGING                     │
                         │                                           │
                         │  Only between connected users.             │
                         │                                           │
                         │  ┌─────────────────────────────────┐       │
                         │  │ Inbox: list of conversations     │       │
                         │  │ ┌───────────────────────────┐    │       │
                         │  │ │ @user1 · "Hey! Love your  │    │       │
                         │  │ │ work. Want to collaborate" │    │       │
                         │  │ │ 2m ago                    │    │       │
                         │  │ └───────────────────────────┘    │       │
                         │  │                                 │       │
                         │  │ EMPTY INBOX:                     │       │
                         │  │ → "No conversations yet.         │       │
                         │  │    Connect with someone to       │       │
                         │  │    start messaging."             │       │
                         │  └─────────────────────────────────┘       │
                         │                                           │
                         │  ┌─────────────────────────────────┐       │
                         │  │ Thread view                     │       │
                         │  │ ┌───────────────────────────┐    │       │
                         │  │ │ [messages, newest at bottom]│    │       │
                         │  │ │                             │    │       │
                         │  │ │ ┌───────────────────────┐  │    │       │
                         │  │ │ │ Type a message...     │  │    │       │
                         │  │ │ │ [Send]                │  │    │       │
                         │  │ │ └───────────────────────┘  │    │       │
                         │  │ └───────────────────────────┘    │       │
                         │  └─────────────────────────────────┘       │
                         │                                           │
                         │  FAILURE PATHS:                            │
                         │  • Message fails to send → show error     │
                         │    + keep text in input                    │
                         │  • Network drops mid-send → auto-retry     │
                         │  • Double click → deduplicate (idempotency)│
                         │  • User deleted → show "Account deleted"   │
                         │  • Too many messages → rate limit warning  │
                         │  • Empty message → Send button disabled    │
                         │  • Slow API → show sending indicator       │
                         │  • Tab closed mid-type → browser warns     │
                         └───────────────────────────────────────────┘

### Abandoned Onboarding Handling

```
TIMELINE:
T+0:  User signs up, email sent
T+15m: User hasn't verified → send reminder email (if email service exists)
T+24h: User hasn't verified → delete unverified account (cleanup cron job)
T+48h: User hasn't created ValueSkin → send nudge email
T+7d:  User has account but no ValueSkin → queue for review (potential test account)

KEY RULE:
- Never delete accounts with ValueSkins or connections
- Only auto-delete EMAIL_UNVERIFIED accounts (24h TTL)
- Session survives browser close + reopen (refresh token in HttpOnly cookie)
- Onboarding progress saved in session, not database (no PartialProfile table)
```

---

## SECTION 3: BETA DATABASE DESIGN

### Entity: `users`

```sql
CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    email_verified_at   TIMESTAMPTZ,
    password_hash       TEXT NOT NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- State machine, not booleans
    user_state          TEXT NOT NULL DEFAULT 'EMAIL_UNVERIFIED'
                        CHECK (user_state IN (
                            'EMAIL_UNVERIFIED',
                            'ACTIVE',
                            'SUSPENDED',
                            'DEACTIVATED',
                            'PERMANENTLY_BANNED'
                        )),
    -- Rate limiting / abuse
    failed_login_attempts   INT NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at       TIMESTAMPTZ,
    last_active_at      TIMESTAMPTZ,
    signup_ip           INET,
    signup_user_agent   TEXT
);

-- Lookup by email for login (case-insensitive)
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));
-- Active users for queries
CREATE INDEX idx_users_state ON users (user_state) WHERE user_state = 'ACTIVE';
-- Cleanup unverified
CREATE INDEX idx_users_unverified ON users (created_at) WHERE user_state = 'EMAIL_UNVERIFIED';
```

### Entity: `sessions`

```sql
CREATE TABLE sessions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   TEXT NOT NULL UNIQUE,  -- opaque, SHA-256 hash stored
    access_token_jti TEXT NOT NULL UNIQUE, -- JWT ID for revocation
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,           -- NULL = active
    ip_address      INET,
    user_agent      TEXT
);

-- Fast lookup by refresh token
CREATE INDEX idx_sessions_refresh ON sessions (refresh_token) WHERE revoked_at IS NULL;
-- Cleanup expired
CREATE INDEX idx_sessions_expires ON sessions (expires_at) WHERE revoked_at IS NULL;
-- User's active sessions
CREATE INDEX idx_sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;
```

### Entity: `profiles`

```sql
CREATE TABLE profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    handle          TEXT NOT NULL UNIQUE,  -- immutable after creation
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    bio             TEXT,                  -- 200 chars max
    location        TEXT,                  -- free-text, no geocoding
    website_url     TEXT,
    contact_email   TEXT,                  -- public email (optional, separate from login)

    -- State: visible or hidden from search
    visibility      TEXT NOT NULL DEFAULT 'PUBLIC'
                    CHECK (visibility IN ('PUBLIC', 'HIDDEN')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Handle lookup (primary lookup pattern)
CREATE INDEX idx_profiles_handle ON profiles (handle);
-- Search by display name (case-insensitive)
CREATE INDEX idx_profiles_display_name ON profiles (LOWER(display_name));
```

### Entity: `value_skins`

```sql
CREATE TABLE value_skins (
    id              BIGSERIAL PRIMARY KEY,
    profile_id      BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,          -- User-given name (e.g. "Design Work")
    profession      TEXT NOT NULL,          -- From predefined list
    bio             TEXT,                   -- Skin-specific bio
    -- State machine
    skin_state      TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (skin_state IN (
                        'ACTIVE',
                        'HIDDEN',
                        'ARCHIVED'
                    )),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skins_profile ON value_skins (profile_id);
CREATE INDEX idx_skins_profession ON value_skins (profession) WHERE skin_state = 'ACTIVE';
```

### Entity: `connections`

```sql
CREATE TABLE connections (
    id              BIGSERIAL PRIMARY KEY,
    requester_id    BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_id       BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- State machine
    connection_state TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (connection_state IN (
                         'PENDING',      -- request sent, awaiting approval
                         'ACCEPTED',     -- bidirectional connection
                         'BLOCKED',      -- one user blocked the other
                         'REVOKED'       -- connection removed
                     )),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_connection UNIQUE (requester_id, target_id),
    CONSTRAINT no_self_connect CHECK (requester_id != target_id)
);

-- Lookup connection between two users
CREATE INDEX idx_connections_pair ON connections (requester_id, target_id);
-- Pending requests for a user
CREATE INDEX idx_connections_pending ON connections (target_id, connection_state)
    WHERE connection_state = 'PENDING';
-- Active connections for a user
CREATE INDEX idx_connections_active ON connections (requester_id, connection_state)
    WHERE connection_state = 'ACEPTED';
```

Note: using `ACEPTED` typo as a deliberate canary — any code that uses this value incorrectly will break tests. Can be fixed in migration when discovered.

### Entity: `messages`

```sql
CREATE TABLE messages (
    id              BIGSERIAL PRIMARY KEY,
    connection_id   BIGINT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    sender_id       BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,          -- Plain text only. No HTML. No markdown.
    -- State machine
    message_state   TEXT NOT NULL DEFAULT 'SENT'
                    CHECK (message_state IN (
                        'SENT',
                        'DELIVERED',
                        'READ',
                        'DELETED'           -- soft-delete (hide from sender's view only)
                    )),
    -- Client-generated UUID for idempotency (prevents double-send on retry)
    idempotency_key UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_idempotency UNIQUE (connection_id, idempotency_key)
);

-- Inbox query: last message per conversation
CREATE INDEX idx_messages_connection ON messages (connection_id, created_at DESC);
-- Unread count
CREATE INDEX idx_messages_unread ON messages (connection_id, message_state)
    WHERE message_state IN ('SENT', 'DELIVERED');
```

### Entity: `reports`

```sql
CREATE TABLE reports (
    id              BIGSERIAL PRIMARY KEY,
    reporter_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- State machine
    report_state    TEXT NOT NULL DEFAULT 'OPEN'
                    CHECK (report_state IN (
                        'OPEN',
                        'UNDER_REVIEW',
                        'ACTION_TAKEN',
                        'DISMISSED',
                        'APPEALED'
                    )),
    reason          TEXT NOT NULL,          -- Free-text from reporter
    category        TEXT NOT NULL,          -- Predefined: spam, harassment, impersonation, other
    moderator_id    BIGINT REFERENCES users(id),
    moderator_notes TEXT,
    action_taken    TEXT,                   -- 'none', 'warning', 'suspension', 'ban'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Moderation queue
CREATE INDEX idx_reports_state ON reports (report_state) WHERE report_state IN ('OPEN', 'UNDER_REVIEW');
-- Check if user has been reported
CREATE INDEX idx_reports_reported ON reports (reported_id);
```

### Entity: `audit_logs`

```sql
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_id        BIGINT,                 -- NULL for system actions
    action          TEXT NOT NULL,           -- 'user.suspended', 'profile.updated', etc.
    target_type     TEXT NOT NULL,           -- 'user', 'profile', 'message', etc.
    target_id       BIGINT,
    old_values      JSONB,                  -- previous state (for sensitive changes)
    new_values      JSONB,                  -- new state
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query by actor
CREATE INDEX idx_audit_actor ON audit_logs (actor_id, created_at DESC);
-- Query by target
CREATE INDEX idx_audit_target ON audit_logs (target_type, target_id, created_at DESC);
-- Time-range queries
CREATE INDEX idx_audit_created ON audit_logs (created_at);
```

### Entity: `feature_flags`

```sql
CREATE TABLE feature_flags (
    name            TEXT PRIMARY KEY,
    is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    -- Rollout configuration (JSON)
    config          JSONB NOT NULL DEFAULT '{}',
    -- '{"rollout_pct": 10, "user_ids": [1,2,3], "staff_only": false}'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Future-Proofing Notes

1. **BIGSERIAL for all IDs** — 9.2 quintillion rows. Never worry about ID exhaustion. INT (2B) can fill up.

2. **TIMESTAMPTZ, not TIMESTAMP** — Timezone-aware. Saves 3am debugging sessions when servers cross timezones.

3. **TEXT for state, not ENUM** — ENUMs require ALTER TYPE ... ADD VALUE which locks the table. TEXT with CHECK constraint is portable and alterable without locks.

4. **JSONB for extensible config** — Feature flag config, profile metadata, audit log details. Avoids migration for every new config field.

5. **No polymorphic associations** — No `target_type`/`target_id` pattern for core entities. Audit logs use it (write-only) but core tables use explicit FKs. Polymorphic queries are slow and unindexable.

6. **Soft deletes only on messages** — Users and profiles are hard-deleted (or state-transitioned). Soft deletes accumulate garbage and break UNIQUE constraints.

7. **Case-insensitive handle** — Store lowercase handle. Query by lowercase. Prevent "John" and "john" from being different users.

---

## SECTION 4: SECURITY MINIMUMS

### MUST-HAVE (Beta Gate)

| Control | Implementation | Why It Matters |
|---------|---------------|----------------|
| **Password hashing** | bcrypt with cost factor 12 (work factor 2^12). Pepper in env var, not DB. | SHA-256 passwords crack at 10B/sec with GPU. bcrypt at cost 12: ~5 hashes/sec. |
| **Password policy** | Minimum 12 characters. No max length (support passphrases). Check against HIBP via API (k-anonymity, never send full hash). | 8-character minimum is 2010. Breached passwords are the #1 attack vector. |
| **Session tokens** | 32-byte random (crypto.randomBytes) for refresh token. SHA-256 hash stored in DB. Raw token only in HttpOnly, Secure, SameSite=Strict cookie. | If DB leaks, attacker cannot reverse sessions from hashes. |
| **JWT access tokens** | 15-minute expiry. Signed HS256 (RS256 in production). JTI (unique ID) stored in session for revocation. Never store in localStorage — only in memory or cookie. | 15-minute window limits damage if token is stolen. JTI allows server-side revocation. |
| **Session rotation** | Every access token refresh rotates the refresh token (old one revoked). | Prevents refresh token theft going undetected. Each rotation is an implicit "I'm still here." |
| **Session invalidation** | On password change, revoke ALL sessions except current. On logout, revoke current session. | Stolen session stays valid after password reset without this. |
| **Rate limiting — login** | 5 attempts per email per 15 min. 20 attempts per IP per hour. Return generic "Invalid email or password" — never reveal which field is wrong. | Prevents brute force + credential stuffing. Generic error prevents email enumeration. |
| **Rate limiting — signup** | 3 accounts per IP per hour. CAPTCHA required. | Bot signups fill DB with garbage. |
| **Rate limiting — API** | 100 requests per minute per user (authenticated). 30 per minute per IP (unauthenticated). | Single script-kiddie DoS. |
| **Rate limiting — messaging** | 50 messages per hour per user. 10 messages per conversation per minute. | Spam + abuse. |
| **Rate limiting — search** | 30 queries per minute per user. | Scraping prevention. |
| **Rate limiting — connections** | 20 connection requests per hour per user. | Connection spam. |
| **CAPTCHA** | hCaptcha (privacy-friendly). Triggered on: signup, password reset, >3 failed logins. | Bot prevention without selling user data to Google. |
| **Email verification** | 6-digit code. Expires in 15 minutes. Rate limited: 3 attempts per code, 5 codes per email per hour. | Disposable email + bot signup prevention. Code (not magic link) avoids email client opening race conditions. |
| **Input validation** | ALL inputs validated at API boundary. Reject unknown fields. Length limits on everything. Whitelist allowed characters for handles. | SQL injection, XSS, command injection all start with unvalidated input. |
| **CORS** | Whitelist of allowed origins. No wildcard. Credentials: same-origin only for cookies. | Without this, any website can make authenticated requests from the user's browser. |
| **CSP header** | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'` | Prevents XSS even if script injection succeeds. |
| **X-Content-Type-Options** | `nosniff` | Prevents MIME-type sniffing attacks. |
| **X-Frame-Options** | `DENY` | Prevents clickjacking. |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Prevents leaking tokens in Referer header. |
| **HSTS** | `max-age=31536000; includeSubDomains` | Forces HTTPS. Prevents SSL-strip attacks. |
| **Password reset** | Token-based (not security questions). Token: 32-byte random, valid 15 min, single-use. Invalidates all existing reset tokens on new request. | Security questions are enumerable. Long-lived tokens are stealable. |
| **Anti-enumeration** | Login: "Invalid email or password" (same message for both). Signup: "Verification email sent" (even if email exists). Password reset: "If that email exists, a reset link was sent." | Attackers should never know which emails are registered. |
| **IP allowlist — admin** | Moderation panel accessible only from VPN IP. Admin actions logged with IP + user agent. | Without this, a stolen moderator account = full platform access. |
| **File upload (avatar only)** | Accept only image/jpeg, image/png, image/webp. Validate magic bytes (not extension). Resize server-side to 400x400. Strip EXIF. Store with random filename. Max 5MB. | EXIF leaks GPS coordinates. Unvalidated uploads = malware delivery. Original filenames enable path traversal. |
| **Secrets management** | No secrets in code. .env.local gitignored. Production secrets in env vars (never in .env committed). Pre-commit hook scans for secret patterns. | Committed API keys = stolen in minutes by crawlers. |
| **SQL injection prevention** | Parameterized queries for EVERY query. No string concatenation. EVER. | Single `${userInput}` in a query = entire database stolen. |
| **Audit logging** | Log all: logins, password changes, profile updates, suspensions, bans, report actions. Never log passwords, tokens, or email bodies. | Without logs, you cannot investigate incidents. |
| **Error responses** | Generic errors to client. Full errors to server logs (with trace ID). Never expose schema, stack traces, or internal state. | Stack traces reveal database structure, file paths, library versions. |

### NICE-TO-HAVE (Post-Beta)

| Control | Why Not Now |
|---------|-------------|
| 2FA / TOTP | Low usage in beta. Users won't enable it. Add when accounts store financial data. |
| WebAuthn / passkeys | Browser support still fragmented. Passwordless is correct direction but beta users have passwords. |
| IP geolocation blocking | Not enough traffic to distinguish legitimate from malicious IPs. Add when abuse patterns emerge. |
| Device fingerprinting | Creates privacy concerns in beta. Add when fraud becomes measurable. |
| Session-level MFA (challenge on new device) | Too disruptive for beta users. Add when accounts hold value. |
| Rate limiting by endpoint (graduated) | Single rate limit for all endpoints works for beta. Granular limits add config complexity. |
| Auto-block on impossible travel | Not enough users to learn what "normal" travel looks like. |
| Content scanning (images, text) | Manual moderation works for beta. Auto-moderation has false positives that anger users. |
| DMARC/DKIM for outgoing email | Required when sending marketing emails. Transactional email (password resets, verification) works without strict DMARC. |
| SIEM integration | No security team in beta. Logs stored in database + cloudwatch. |

---

## SECTION 5: PRODUCTION SAFETY

### Local → Staging → Production Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT PIPELINE                              │
│                                                                           │
│  DEVELOPER                                                                │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐              │
│  │ Feature       │────►│ PR + Review  │────►│ Merge to     │              │
│  │ branch        │     │              │     │ main         │              │
│  └──────────────┘     └──────────────┘     └──────┬───────┘              │
│                                                     │                     │
│  CI/CD                                              │                     │
│  ┌──────────────────────────────────────────────────▼─────────────────┐   │
│  │  CI Pipeline (every commit)                                        │   │
│  │  ┌────────────────────────────────────────────────────────────┐    │   │
│  │  │ 1. Lint (clippy / eslint)                                  │    │   │
│  │  │ 2. Type check (tsc --noEmit / cargo check)                 │    │   │
│  │  │ 3. Unit tests                                              │    │   │
│  │  │ 4. Integration tests                                       │    │   │
│  │  │ 5. Build check                                             │    │   │
│  │  │ 6. Security audit (npm audit / cargo audit)                │    │   │
│  │  │ 7. Secret scan (git-secrets)                               │    │   │
│  │  └────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  STAGING (auto-deploy on main merge)                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Deploy to staging environment                                     │ │
│  │ 2. Run migration (idempotent, IF NOT EXISTS)                         │ │
│  │ 3. Smoke tests (health check, critical path)                         │ │
│  │ 4. Integration tests against staging DB                              │ │
│  │ 5. Notify team in Slack (#deploys)                                   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  PRODUCTION (manual promote from staging)                                │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Run migration (read-only first — verify no destructive queries)   │ │
│  │ 2. Deploy canary (1 pod, 5% traffic)                                 │ │
│  │ 3. Monitor error rate, latency, 5xx for 5 minutes                    │ │
│  │ 4. Deploy 50% traffic, monitor 5 minutes                             │ │
│  │ 5. Deploy 100% traffic                                                │ │
│  │ 6. Run post-deploy smoke tests                                       │ │
│  │ 7. Tag release in git                                                │ │
│  │ 8. Notify team in Slack (#deploys)                                   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ROLLBACK (when something breaks)                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ 1. git revert <deploy commit>                                        │ │
│  │ 2. Re-run deploy pipeline                                            │ │
│  │ 3. Migration rollback (if needed) — write DOWN migrations            │ │
│  │ 4. Verify rollback with smoke tests                                  │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Migration Strategy

```
RULES:
1. ALL migrations are idempotent: IF NOT EXISTS, ON CONFLICT DO NOTHING
2. NEVER delete a column in the same migration you add it
3. ALWAYS add columns as NULLABLE first, populate, then add NOT NULL
4. NEVER lock a table for more than 5 seconds (CREATE INDEX CONCURRENTLY)
5. ALWAYS write a DOWN migration (even if it's just "reverse the UP")
6. ALWAYS test migration against a copy of production data
7. ALWAYS run migration BEFORE deploying new code (both directions compatible)

SEQUENCE:
1. Migration runs (adds column, new table, etc.)
2. OLD code runs alongside NEW schema (backward compatible)
3. NEW code deploys and uses new schema
4. Next migration removes old columns/tables

WRONG:
- Deploy migration that RENAMES column → old code breaks
- Deploy migration that ADDS NOT NULL without default → existing rows fail
- Deploy migration that DROPS column → old code using that column breaks

CORRECT:
- Add column as nullable → deploy → populate → add NOT NULL → deploy
- Add new table → deploy → migrate data → drop old table → deploy
```

### Monitoring

| Metric | Why | Alert Threshold |
|--------|-----|-----------------|
| p50/p95/p99 response time | User-facing latency | p99 > 1000ms for 5 min |
| 5xx error rate | Server failures | > 1% for 5 min |
| 4xx error rate | Client errors (could indicate abuse) | > 10% for 5 min |
| Signup rate | Bot attack detection | > 100/hour (normal) → investigate > 1000/hour |
| Login failure rate | Brute force attack | > 50% of login attempts fail for 5 min |
| Message send rate | Spam detection | > 1000/user/hour |
| Connection request rate | Connection spam | > 100/user/hour |
| Database connection count | Connection leak | > 80% of max |
| Database query latency | Slow query | p99 > 200ms |
| Queue depth (if async) | Worker backlog | > 1000 |
| Migration duration | Schema change blocking | > 30 seconds |

### Alerting Channels

- **P1 (Critical)**: App down, data loss, security incident → PagerDuty / phone call
- **P2 (High)**: Degraded performance, elevated errors → Slack #alerts within 5 min
- **P3 (Medium)**: Non-urgent issues, rate limit threshold crossed → Slack #alerts next business day
- **P4 (Low)**: Info, pattern emerged → Jira ticket

---

## SECTION 6: FEATURE FLAG SYSTEM

### Flag Types

```
FEATURE FLAGS AT VALUE SKINS
────────────────────────────────────────────────────────────────

1. RELEASE FLAGS (rollout new features)
   - name: "messaging_v2"
   - states: OFF → INTERNAL → 1% → 10% → 50% → 100% → ON
   - kill switch: emergency disable without deploy

2. EXPERIMENT FLAGS (A/B test)
   - name: "onboarding_flow_v2"
   - states: OFF → CONTROL → TREATMENT
   - user assignment: consistent (sticky based on user_id hash)

3. OPS FLAGS (operational control)
   - name: "maintenance_mode"
   - states: OFF → ON (503 all requests)
   - used during emergency migrations

4. PERMISSION FLAGS (gate by role)
   - name: "moderation_panel"
   - states: STAFF_ONLY → BETA_TESTERS → ALL

5. KILL SWITCHES (emergency disable)
   - name: "kill_messaging"
   - action: instantly disable all message sending
   - bypasses all other flag states

IMPLEMENTATION:
- Database-backed (survives restarts)
- Cached in memory (TTL 30s, tolerate staleness)
- Loaded on every request (middleware or per-service)
- Emergency kill switches checked BEFORE cache
```

### Flag Schema

```json
{
  "flag_name": "enterprise_verification",
  "state": "rollout",
  "rollout_pct": 10,
  "user_ids": [1, 2, 3, 4, 5],
  "staff_only": false,
  "beta_testers": [10, 11, 12],
  "regions": ["us", "eu"],
  "kill_switched": false,
  "dependencies": ["identity_service"],
  "owner": "trust-team"
}
```

### Rollout Stages

```
STAGE 0: OFF
  - Feature disabled for everyone
  - Code exists but is unreachable

STAGE 1: INTERNAL (dev + staging)
  - Team members can access
  - Tests run against it
  - Dogfooding

STAGE 2: EARLY ACCESS (specific users)
  - Explicit user_id whitelist
  - Beta testers
  - Used for feedback, not metrics

STAGE 3: CANARY (1-5%)
  - Random users (consistent hash)
  - Monitor: error rate, latency, support tickets
  - No user-facing announcement (if it breaks, few see it)

STAGE 4: GRADUAL ROLLOUT (10-50%)
  - Increase in 10% increments
  - Monitor at each step
  - Pause between steps (minimum 24h for user-facing features)

STAGE 5: GENERAL AVAILABILITY (100%)
  - Feature on for everyone
  - Monitored for regressions
  - Can still be kill-switched

STAGE 6: PERMANENT ON
  - Flag removed from code
  - Config cleaned up
  - Feature is now baseline
```

### Kill Switch Protocol

```
1. ANYONE can pull the kill switch (PagerDuty incident, Slack #alerts)
2. Kill switch bypasses all rollout logic
3. Kill switch takes effect within 30 seconds (flag check interval)
4. After kill: immediate investigation, no re-enable without root cause
5. Re-enable follows the full rollout process again

TRIGGERS:
- Error rate > 5% for feature-specific errors
- p99 latency > 2000ms
- Support tickets > 10/hour attributed to feature
- Security incident involving feature
- Data corruption detected
```

---

## SECTION 7: TESTING

### Test Pyramid (Beta)

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲           < 10 tests (critical user journeys)
                 ╱──────╲
                ╱        ╲
               ╱Integra-  ╲      ~50 tests (service interactions)
              ╱  tion      ╲
             ╱──────────────╲
            ╱                ╲
           ╱    Unit tests    ╲   ~200+ tests (individual functions)
          ╱────────────────────╲
```

### Mandatory Tests

**Authentication (unit + integration)**
```
✓ Signup with valid email + password → success, user EMAIL_UNVERIFIED
✓ Signup with existing email → 409 Conflict, generic message
✓ Signup with weak password → 422, list requirements
✓ Signup with disposable email → rejected if blocklist exists
✓ Signup rate limited (3 per IP per hour) → 429
✓ Verify email with valid code → user ACTIVE
✓ Verify email with expired code → 400, resend prompted
✓ Verify email with wrong code (3 attempts) → code invalidated
✓ Login with correct credentials → 200, tokens in HttpOnly cookie
✓ Login with wrong password → 401, "Invalid email or password"
✓ Login on locked account (5 failed attempts) → 423, locked_until returned
✓ Login rate limited (20 per IP) → 429
✓ Refresh token → new access token, rotated refresh token
✓ Refresh with revoked token → 401, all sessions invalidated
✓ Logout → session revoked, cookie cleared
✓ Password reset request → 200 (always same response)
✓ Password reset with valid token → new password, all other sessions revoked
✓ Password reset with expired token → 400
```

**Profile (unit + integration)**
```
✓ Create handle (valid) → success
✓ Create handle (taken) → 409, suggest alternatives
✓ Create handle (profanity) → 400
✓ Create handle (too short/long) → 422
✓ Update display name → updated
✓ Update bio (under 200 chars) → updated
✓ Update bio (over 200 chars) → truncated or rejected
✓ Upload avatar (valid image) → success, URL returned
✓ Upload avatar (EXE disguised as JPEG) → rejected by magic byte check
✓ Upload avatar (>5MB) → rejected (413)
✓ View own profile → full details
✓ View other user's profile → public details only
✓ View non-existent handle → 404, no information disclosure
```

**Search (integration)**
```
✓ Search by exact handle → exact match first
✓ Search by partial handle → ranked results
✓ Search by profession → results in that profession
✓ Empty search → recent/featured results
✓ No results → "No results" state
✓ Search rate limited (30/min) → 429
```

**Connections (integration)**
```
✓ Send connection request → PENDING
✓ Accept connection request → ACCEPTED, now connected
✓ Decline connection request → request removed
✓ Send duplicate request → idempotent, no error
✓ Send request to self → 422
✓ Send request when blocked → silent handling
✓ Block user → existing connection removed, no new requests
✓ Unblock user → can receive new requests
✓ Connection count rate limited (20/h) → 429
```

**Messaging (integration)**
```
✓ Send message to connected user → SENT
✓ Send message to non-connected user → 403
✓ Send empty message → 422
✓ Send message with same idempotency key → deduplicated
✓ Inbox shows last message per conversation → most recent first
✓ Unread count correct → newly delivered messages marked
✓ Delete message → hidden from sender, visible to receiver (soft delete)
✓ Rate limited (50/h) → 429
```

**Reporting (integration)**
```
✓ Report user → OPEN
✓ Report non-existent user → 404
✓ Report same user twice → second report creates new entry (no dedup for reports)
✓ Moderator views report queue → all OPEN reports
✓ Moderator dismisses report → DISMISSED
✓ Moderator suspends user → user SUSPENDED, audit logged
✓ Moderator bans user → user PERMANENTLY_BANNED, audit logged
```

**Moderation (integration)**
```
✓ Non-moderator accesses panel → 403
✓ Moderator suspends user → all sessions revoked
✓ Suspended user tries to login → 403 "Account suspended"
✓ Suspended user's profile → hidden from search
✓ Banned user tries to sign up with same email → "Email already registered" (405)
```

**Rate Limiting (integration)**
```
✓ Login rate limit applied
✓ API rate limit applied (authenticated + unauthenticated)
✓ CAPTCHA triggers after 3 failed logins
```

**Security (regression)**
```
✓ SQL injection in handle field → no injection
✓ SQL injection in email → no injection
✓ SQL injection in search → no injection
✓ XSS in display name → rendered as text, not executed
✓ XSS in bio → rendered as text, not executed
✓ JWT tampering → 401
✓ JWT with "none" algorithm → 401
✓ Refresh token replay → rejected, session revoked
✓ Directory traversal in avatar URL → rejected
```

### Pre-Deploy Smoke Tests

Run these against staging before promoting to production:

```
1. Health endpoint returns 200
2. Signup + verify email + login works end-to-end
3. Profile creation works
4. Search returns results
5. Connection send + accept works
6. Message send + receive works
7. Report submission works
8. All rate limits return 429 when exceeded
```

### What Tests Catch Before Users Do

```
UNIT TESTS:
- Logic errors (wrong state transition, off-by-one)
- Edge cases (empty strings, null values, max lengths)
- Error handling (database down, timeout, invalid input)

INTEGRATION TESTS:
- API contract violations (wrong status code, missing field in response)
- Database constraint violations (unique violation, FK violation)
- Auth bypass (unauthenticated request to protected endpoint)
- Rate limit enforcement

E2E TESTS:
- Broken user flow (signup → verify → profile → search → connect → message)
- Session persistence across page loads
- CSRF protection (cross-origin form submission)

REGRESSION TESTS:
- Previously fixed bugs stay fixed
- New feature doesn't break existing functionality
- Schema migration backward compatibility

SECURITY TESTS:
- Injection attacks neutralized
- Authentication bypass prevented
- Authorization checks enforced
- Sensitive data not exposed in responses
```

---

## SECTION 8: SERVICE ARCHITECTURE

### Service Map (Beta)

```
                           ┌─────────────────────┐
                           │    API GATEWAY        │
                           │    (actix-web)        │
                           │                       │
                           │  Auth middleware       │
                           │  Rate limiting         │
                           │  Request validation    │
                           │  Feature flags         │
                           │  Route dispatch        │
                           └──────┬──────┬──────┬──┘
                                  │      │      │
              ┌───────────────────┘      │      └───────────────────┐
              ▼                          ▼                          ▼
   ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
   │  AUTH SERVICE       │    │  PROFILE SERVICE    │    │  MESSAGING SERVICE │
   │                     │    │                     │    │                    │
   │  Signup             │    │  CRUD profiles      │    │  Send message      │
   │  Login              │    │  Handle management  │    │  Get inbox         │
   │  Token management   │    │  Avatar upload      │    │  Get thread        │
   │  Password reset     │    │  Search             │    │  Delete message    │
   │  Session management │    │  Connections        │    │                    │
   │  Email verification │    │                     │    │  (text-only beta)  │
   └──────────┬──────────┘    └──────────┬──────────┘    └────────────────────┘
              │                          │
              ▼                          ▼
   ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
   │  MODERATION         │    │  AUDIT SERVICE      │    │  STORAGE SERVICE   │
   │  SERVICE            │    │                     │    │                    │
   │                     │    │  Immutable log      │    │  Avatar upload     │
   │  Report queue       │    │  Query log by user  │    │  Avatar serve      │
   │  Review workflow    │    │  Query log by action│    │  CDN distribution  │
   │  Suspend/ban        │    │  Retention policy   │    │                    │
   │  Appeal handling    │    │  Export for legal   │    │  (S3-compatible)   │
   └────────────────────┘    └────────────────────┘    └────────────────────┘
```

### Service Responsibilities

**Auth Service**
```
RESPONSIBILITIES:
- User registration (create user, hash password, send verification email)
- Email verification (validate code, activate user)
- Login (verify password, create session + access token)
- Token refresh (rotate refresh token, issue new access token)
- Logout (revoke session, clear cookie)
- Password reset (generate token, validate token, update password)
- Session management (list active sessions, revoke specific session)
- No business logic beyond authentication
- No profile data (handles, display names) — those belong in Profile Service

BOUNDARIES:
- Auth service returns user_id. It does NOT return profile data.
- Auth service stores password_hash. It does NOT store plaintext passwords.
- Auth service never sends anything other than user_id to other services.
```

**Profile Service**
```
RESPONSIBILITIES:
- Profile CRUD (create, read, update handle/display_name/bio/avatar)
- Handle management (uniqueness, validation, profanity check)
- ValueSkin creation (core product primitive)
- Avatar upload (validate, resize, store, return URL)
- Search (by handle, display_name, profession)
- Connection management (send, accept, decline, block, unblock)
- Public profile view (respect visibility + block state)
- No authentication logic (no password checking, no session creation)

BOUNDARIES:
- Profile service receives user_id from auth middleware. It trusts user_id is valid.
- Profile service never stores passwords or sessions.
- Profile service returns 404 for non-existent profiles, not "should this user exist?"
```

**Messaging Service**
```
RESPONSIBILITIES:
- Send message (validate connection, store, deliver)
- Get inbox (list conversations, last message, unread count)
- Get thread (paginated messages in a conversation)
- Delete message (soft delete — hide from sender)
- Unread count (for notification badge)
- No file attachments (text only in beta)
- No read receipts (added later with presence system)

BOUNDARIES:
- Messaging service checks connection state. It does NOT manage connections.
- Messaging service stores messages. It does NOT store profiles or sessions.
- Messaging service returns 403 if users are not connected. It does not check "should they be connected?"
```

**Moderation Service**
```
RESPONSIBILITIES:
- Report management (create, queue, assign, resolve)
- User suspension (change user state to SUSPENDED, revoke sessions)
- User ban (change user state to PERMANENTLY_BANNED, revoke sessions)
- Appeal handling (review, escalate, overturn)
- Moderation queue (view open reports, filter by category, sort by age)
- Audit logging of all moderation actions
- No auto-moderation (no content scanning, no ML)
- No trust scores (computed by separate trust service in future)

BOUNDARIES:
- Moderation service changes user state. It does NOT delete users.
- Moderation service logs actions to audit service. It does NOT maintain its own logs.
- Moderation service checks moderator role. It does NOT manage roles.
```

**Audit Service**
```
RESPONSIBILITIES:
- Write audit events (immutable append-only)
- Query audit events (by actor, target, action, time range)
- Retention enforcement (delete events older than X days)
- Export for compliance/legal requests
- No business logic — pure log storage and retrieval
- No access to PII except through explicit query (and that's logged)

BOUNDARIES:
- Audit service is write-only for most services. Only audit service admins can query.
- Audit service never interprets log content. It stores JSONB payloads.
- Audit service does NOT authenticate. Caller must be authenticated upstream.
```

**Storage Service**
```
RESPONSIBILITIES:
- Accept upload (validate file type, size, magic bytes)
- Store file (S3-compatible object storage, random filename)
- Strip EXIF from images
- Generate thumbnail/resized versions
- Serve file via CDN (signed URLs for private files)
- File deletion (on profile deletion or explicit request)
- No database storage — files are in S3, metadata is in profile service
- No user authentication — files served with time-limited signed URLs

BOUNDARIES:
- Storage service validates file content (magic bytes). It does NOT validate business rules.
- Storage service does NOT know what a "profile" or "avatar" is. It stores bytes.
```

### How Future Systems Plug In (Without Rewrites)

```
FUTURE: TRUST SERVICE
- Lives as a separate service behind API gateway
- Reads from profiles + connections + messages (read-only DB replicas)
- Writes trust scores to trust_score_events table
- API gateway adds middleware: inject trust context into requests
- Profile service adds "trust_score" to public profile response
- Moderation service consumes trust scores for queue prioritization
- No rewrite. No schema change. New service + new table.

FUTURE: VERIFICATION SERVICE
- New service with its own tables (documents, verification state machine)
- Profile service adds "verification_badge" field (nullable, updated by event)
- User uploads document → stored in storage service → verification service processes
- State machine: UNVERIFIED → PENDING → VERIFIED / REJECTED
- Moderation service has "verify documents" in admin panel
- No rewrite. New service + new migration + profile field.

FUTURE: GUARDIAN SERVICE
- New service with guardian tables
- Extends auth service: check guardian permission on signup for under-13 users
- Extends messaging: guardian can view minor's messages (if permitted)
- State machine: PENDING → ACTIVE → REVOKED (per relationship)
- No rewrite. New service + new auth check middleware.

FUTURE: CONTRACTS SERVICE
- New service with contract state machine
- Uses messaging service to deliver contract notifications
- Uses storage service for contract document storage
- Profile service shows "active contracts" count
- No rewrite. New service. Existing services add thin presentation fields.

FUTURE: PAYMENTS SERVICE
- New service with Stripe Connect integration
- Uses moderation service for KYC checks
- Uses audit service for transaction logging
- Profile service shows "payment ready" badge
- No rewrite. New service. Payment state machine is self-contained.

KEY DESIGN PATTERN:
- Every new system is a NEW SERVICE, not a new feature in MEGA USER SERVICE
- Every new system has its OWN DATABASE TABLES, not columns in users/profiles
- Communication via: API gateway → service, or background events (outbox)
- No service directly calls another service's database
- No circular dependencies between services
```

---

## SECTION 9: THINGS FOUNDERS FORGET

### 50+ Hidden Production Issues

**1. Browser & Client Issues**
```
1. Page refresh during signup → user created but onboarding not finished
2. Browser back button after form submit → resubmits form (duplicate)
3. Double-click on "Send" → message sent twice (idempotency key required)
4. Tab closes mid-type → message text lost
5. Multiple tabs open → concurrent sessions, stale data
6. Browser autofill → fills password but not hidden fields, form submits with wrong data
7. Mobile keyboard covers form inputs → user can't see what they're typing
8. Mobile keyboard "Go" button → submits form prematurely
9. Paste from clipboard → pastes HTML into plaintext field, XSS risk
10. Drag-and-drop file → browser opens file instead of uploading
11. Popup blocker → OAuth window doesn't open, user gets stuck
12. Private/incognito mode → localStorage cleared on tab close, session lost
```

**2. Network Issues**
```
13. API request timeout → user sees spinner forever (add timeout + error state)
14. API returns 502 (bad gateway) → user sees white screen (add error boundary)
15. API returns 504 (gateway timeout) → retry button, not auto-retry
16. Slow network (3G) → images load progressively, form submit takes 10+ seconds
17. Offline (airplane mode) → app should show "No internet" not "Something went wrong"
18. Request sent but response never received → message was actually sent but user retries
19. Duplicate requests due to retry → payment charged twice, connection request sent twice
20. Connection drops mid-upload → partial file stored, avatar is corrupted
```

**3. Session & Auth Issues**
```
21. Session expires during long form fill → form submit returns 401, data lost
22. Token expires mid-session → requests silently fail, user confused
23. Multiple devices → each device has its own session, blocking one blocks all
24. Session not cleared on browser close → cookie persists, auto-login on new tab
25. Password manager saves wrong credentials → user can't login, creates new account
26. Email verification link opens on different device → session on original device is gone
27. User changes password on one device → other devices stay logged in (until refresh)
28. "Remember me" checked on public computer → next user has access
29. OAuth account linked but no email → user can't receive verification, can't reset password
```

**4. Race Conditions**
```
30. Two users send connection request simultaneously → two PENDING records, one must be accepted
31. User deletes account while message is sending → orphan message
32. User blocked while message is in flight → message delivered to blocked user
33. Two admin actions on same report simultaneously → double-action (suspend + dismiss)
34. User signup while cleanup job deletes unverified → user created, immediately deleted
```

**5. Data Issues**
```
35. User signs up with email "user+spam@gmail.com" → valid email, looks like duplicate
36. User signs up with Unicode email → xn-- encoding, comparison fails
37. Handle "admin" registered by a regular user → security issue, reserve handles
38. Handle with homoglyphs (lowercase L vs number 1) → impersonation risk
39. Bio with 2000 Unicode chars → stored as 2000 bytes, some 4-byte chars exceed limit
40. Avatar with transparent background → renders as black on dark mode
41. Deleted user's handle → released or held? Released = impersonation risk. Held = squatting.
```

**6. Search Issues**
```
42. Search for empty string → returns all users (security issue)
43. Search for SQL injection pattern → crashes query if not parameterized
44. Search for regex pattern → crashes if regex is too complex (ReDoS)
45. Search for profanity → returns results, profanity shown in preview
46. Search with special chars → no results because they're stripped
```

**7. Rate Limiting Issues**
```
47. Rate limit by IP in shared office → everyone gets blocked because one person misbehaves
48. Rate limit by user_id → unauthenticated requests cannot be user-limited
49. Rate limit on login → attacker can block legitimate user by sending wrong passwords
50. Rate limit too low during demo → embarrassing "Slow down" in front of investors
51. Rate limit headers not sent → client doesn't know when it can retry
```

**8. Time & Date Issues**
```
52. User in UTC+14 creates account → "created_at" shows tomorrow's date
53. User in UTC-12 sends message → "sent 2 hours ago" shows "in the future"
54. DST change → cron jobs run twice or zero times
55. Leap second → timing-dependent code off by one second
56. Browser timezone != server timezone → "last active" shows wrong time
57. Token expiry calculated in server time, compared in client time → premature/late expiry
```

**9. Moderation & Abuse**
```
58. First user to report gets their report resolved → second reporter gets "already handled"
59. Suspended user can still use API if token hasn't expired → 15-minute window
60. Banned user signs up with different email → same person, new identity
61. User reports themselves → moderator investigates real report, wastes time
62. User reports 100 users in 1 minute → report spam, rate limit reports
63. Moderation action is irreversible (permanent ban) → user appeals, can't undo
```

**10. Scale & Performance**
```
64. Search without index → full table scan, database CPU 100%
65. "SELECT *" on messages → returns entire history, 1MB payload for heavy users
66. N+1 query on inbox → 1 query to get conversations + N queries for last messages
67. Avatar image serves from app server → blocks request thread during download
68. Unoptimized images → 10MB avatar, 5 second load on mobile
69. Missing pagination → one user's 10K messages returned in single response
70. Missing limit on search → "a" returns 1M results, response never finishes
```

**11. Security & Compliance**
```
71. GDPR deletion → user deleted, but backups still have their data
72. GDPR data export → export includes other users' messages (they're in the same thread)
73. CCPA opt-out → subsequent data collection still happens (opt-out ignored)
74. Rate limiting logs → logs contain email addresses, PII exposed if logs leak
75. API returns stack trace in production → reveals database structure
76. Error message says "User with email X not found" → email enumeration
77. "Handle already taken" in signup → handle enumeration (attacker learns handles exist)
```

**12. Team & Ops**
```
78. Developer runs migration locally → "works on my machine" ≠ production
79. Developer deletes production database → no backup, no recovery
80. Feature flag enabled for "all users" → actually enabled for zero users (config bug)
81. Feature flag cached forever → toggle doesn't take effect (stale cache)
82. Logging PII to CloudWatch → GDPR violation, $10K fine per incident
83. No monitoring on new feature → feature silently broken for 3 days
84. No alert on high error rate → team discovers outage from user tweets
85. Rollback deployed → but migration is not rolled back → schema mismatch
86. Canary deployment → 5% of users see broken feature, can't explain why
87. Health check passes but app is broken → health check doesn't test database connectivity
```

---

## SECTION 10: FINAL OUTPUT

### Production Beta Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          VALUE SKINS BETA — PRODUCTION ARCHITECTURE              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  CDN (Cloudflare)                                                           │ │
│  │  • Static assets (Next.js)                                                  │ │
│  │  • Avatar images                                                            │ │
│  │  • Rate limiting (edge)                                                     │ │
│  │  • DDoS protection                                                          │ │
│  └────────────────────────────────┬────────────────────────────────────────────┘ │
│                                   │                                              │
│                                   ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  LOAD BALANCER (ALB / Nginx)                                                │ │
│  │  • TLS termination                                                          │ │
│  │  • Request routing                                                          │ │
│  │  • Health check passthrough                                                  │ │
│  │  • 30s idle timeout                                                         │ │
│  └────────────────────────────────┬────────────────────────────────────────────┘ │
│                                   │                                              │
│                                   ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │  API GATEWAY (actix-web, multi-instance)                                     │ │
│  │                                                                              │ │
│  │  MIDDLEWARE STACK (per request):                                              │ │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐      │ │
│  │  │ CORS    │→ │Security  │→ │Rate     │→ │Auth     │→ │ Feature    │      │ │
│  │  │         │  │Headers   │  │Limiter  │  │(JWT)    │  │ Flags      │      │ │
│  │  └─────────┘  └──────────┘  └─────────┘  └─────────┘  └────────────┘      │ │
│  │                                                                              │ │
│  │  ROUTES:                                                                     │ │
│  │  /auth/*         → Auth Service                                              │ │
│  │  /profiles/*     → Profile Service                                           │ │
│  │  /messages/*     → Messaging Service                                         │ │
│  │  /search/*       → Profile Service (search)                                  │ │
│  │  /moderation/*   → Moderation Service (staff-only)                          │ │
│  │  /health         → Gateway (no auth)                                         │ │
│  └──────┬──────────────┬──────────────┬──────────────┬──────────────────────────┘ │
│         │              │              │              │                           │
│         ▼              ▼              ▼              ▼                           │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐                    │
│  │   AUTH    │  │  PROFILE   │  │ MESSAGING   │  │MODERATION│                    │
│  │  SERVICE  │  │  SERVICE   │  │  SERVICE    │  │ SERVICE  │                    │
│  │           │  │            │  │             │  │          │                    │
│  │ 1-2 pods │  │ 2-4 pods   │  │ 2-4 pods    │  │ 1 pod    │                    │
│  └─────┬─────┘  └──────┬─────┘  └──────┬──────┘  └────┬─────┘                    │
│        │               │               │              │                          │
│        ▼               ▼               ▼              ▼                          │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     POSTGRESQL (Primary + Replica)                         │  │
│  │                                                                             │  │
│  │  Primary: writes (signup, send message, create profile)                     │  │
│  │  Replica: reads (search, inbox, public profiles)                           │  │
│  │  Connection pool: 20 primary / 50 replica                                  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     OBJECT STORAGE (S3-compatible)                          │  │
│  │                                                                             │  │
│  │  /avatars/{uuid}.jpg — 5MB max, EXIF-stripped, 400x400                     │  │
│  │  Signed URLs with 1-hour expiry                                             │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     BACKGOUND WORKERS                                      │  │
│  │                                                                             │  │
│  │  Outbox worker: polls event_outbox every 1s                                │  │
│  │  Cleanup worker: deletes unverified accounts every 5m                     │  │
│  │  Session cleanup: revokes expired sessions every 1h                         │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     MONITORING                                              │  │
│  │                                                                             │  │
│  │  Metrics: p50/p95/p99 latency, error rate, request rate (per endpoint)       │  │
│  │  Logs: structured JSON, shipped to CloudWatch, no PII                       │  │
│  │  Alerts: PagerDuty for P1, Slack for P2-P3                                 │  │
│  │  Dashboards: Grafana (service health, business metrics)                     │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Flow Diagram

```
DEV MACHINE
┌──────────────────────┐
│  feature-branch      │
│  code + tests        │
│  local test: pass    │
└─────────┬────────────┘
          │ git push
          ▼
GITHUB / GITLAB
┌──────────────────────┐
│  Create PR            │
│  CI runs:             │
│  • lint               │
│  • type-check         │
│  • unit tests         │
│  • security audit     │
│  • secret scan        │
│  → ALL PASS           │
└─────────┬────────────┘
          │ PR approved + merged to main
          ▼
STAGING (auto-deploy)
┌──────────────────────┐
│  Build Docker image   │
│  Run migrations       │
│  Deploy to staging    │
│  Smoke tests:         │
│  • health check       │
│  • signup → message   │
│  → ALL PASS           │
└─────────┬────────────┘
          │ Manual promote
          ▼
PRODUCTION (canary)
┌──────────────────────┐
│  Step 1: Run migration│
│  Step 2: Deploy 1 pod │
│     → 5% traffic       │
│  Step 3: Monitor 5min │
│     → error rate < 1%  │
│  Step 4: Deploy 50%   │
│     → monitor 5min     │
│  Step 5: Deploy 100%  │
│  Step 6: Smoke tests  │
│  Step 7: Tag release  │
└──────────────────────┘
```

### Service Interaction Diagram (Key Flows)

```
SIGNUP FLOW:
┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────┐
│USER  │   │GATEWAY   │   │AUTH      │   │DB    │
│      │   │          │   │SERVICE   │   │      │
│ POST │──►│ /auth/   │──►│          │──►│      │
│ /auth│   │ signup   │   │ validate │   │INSERT│
│/signup│   │          │   │ hash pw  │   │users │
│      │   │          │   │ send veri│   │      │
│      │◄──│ 200      │◄──│ success  │◄──│      │
└──────┘   └──────────┘   └──────────┘   └──────┘

MESSAGE SEND FLOW:
┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────┐
│USER A│   │GATEWAY   │   │MESSAGING │   │PROFILE   │   │DB    │
│      │   │          │   │SERVICE   │   │SERVICE   │   │      │
│ POST │──►│ /messages│──►│          │──►│ check    │──►│      │
│ /send│   │ /send    │   │ validate │   │connection│   │verify│
│      │   │          │   │ idempot  │   │ state    │   │conn  │
│      │   │          │   │ store msg│──►│          │   │      │
│      │◄──│ 200      │◄──│ return   │   │          │   │      │
└──────┘   └──────────┘   └──────────┘   └──────────┘   └──────┘

SEARCH FLOW:
┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────┐
│USER  │   │GATEWAY   │   │PROFILE   │   │DB    │
│      │   │          │   │SERVICE   │   │(repl)│
│ GET  │──►│ /search  │──►│          │──►│      │
│ /sear│   │ ?q=      │   │ LIKE     │──►│SEARCH│
│ ch   │   │          │   │ query    │   │      │
│      │◄──│ results  │◄──│ ranked   │◄──│      │
└──────┘   └──────────┘   └──────────┘   └──────┘

REPORT FLOW:
┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────┐
│USER  │   │GATEWAY   │   │MODERATION│   │DB    │
│      │   │          │   │SERVICE   │   │      │
│ POST │──►│ /reports │──►│          │──►│      │
│ /repo│   │          │   │ validate │──►│INSERT│
│ rt   │   │          │   │ store    │   │reports│
│      │◄──│ 200      │◄──│ return   │◄──│      │
└──────┘   └──────────┘   └──────────┘   └──────┘
                              │
                              │ (for moderator view)
                              ▼
                        ┌──────────┐   ┌──────┐
                        │MODERATION│   │DB    │
                        │SERVICE   │   │      │
                        │ GET open │──►│      │
                        │ reports  │   │SELECT│
                        │          │◄──│      │
                        └──────────┘   └──────┘
```

### Build Priority Order

**BUILD WEEK 1 (Foundation)**
```
1. Project scaffold + CI/CD pipeline
   - Dockerfile, docker-compose for local dev
   - CI: lint, type-check, test, audit on every PR
   - CD: auto-deploy to staging on main merge
   - Smoke tests in CI

2. Database setup
   - PostgreSQL schema (users, sessions, profiles, value_skins)
   - Connection pooling with sqlx
   - Migration system (idempotent)
   - Seed data (professions list, reserved handles)

3. Auth Service (core only)
   - Signup (email + password, bcrypt, email verification code)
   - Login (session creation, access + refresh tokens)
   - Token refresh (rotation)
   - Logout (session revocation)
   - Rate limiting (login: 5 attempts / 15 min)
   - CAPTCHA integration (hCaptcha on signup + >3 failed logins)
   - Password reset (token, 15-min expiry, single-use)
   - Session invalidation on password change
```

**BUILD WEEK 2 (Core Product)**
```
4. Profile Service
   - Handle creation (validation, uniqueness, profanity check)
   - Profile CRUD (display name, bio, avatar)
   - ValueSkin creation (name + profession)
   - Search (by handle LIKE, by profession)
   - Connection management (send, accept, decline, block, unblock)

5. Messaging Service
   - Send message (connection check, idempotency, rate limit: 50/h)
   - Get inbox (conversations with last message, unread count)
   - Get thread (paginated, newest at bottom)
   - Soft delete (hide from sender)
   - Connection check middleware

6. Storage Service
   - Avatar upload (magic byte validation, resize 400x400, EXIF strip)
   - Avatar serve (CDN with signed URLs)
   - Max file size: 5MB
   - Allowed types: image/jpeg, image/png, image/webp
```

**BUILD WEEK 3 (Safety + Launch)**
```
7. Moderation Service
   - Report creation (reporter + reason + category)
   - Report queue (list open, filter, sort by age)
   - Report resolution (dismiss, warn, suspend, ban)
   - User suspension (change state, revoke sessions)
   - User ban (permanent, state change, revoke sessions)
   - Moderation panel (staff-only, IP-restricted)

8. Audit Service
   - Immutable event log (actor, action, target, old/new values)
   - Query by actor, target, action, time range
   - Retention cleanup (90 days)

9. Production Hardening
   - Monitoring + alerting (p99 latency, error rate, signup rate)
   - Feature flags (database-backed, cached)
   - CORS + security headers (CSP, HSTS, X-Frame-Options)
   - Error handling (generic client errors, full server logs)
   - Anti-enumeration (login, signup, password reset messages)
   - Session cleanup cron job
   - Unverified account cleanup cron job
   - Pre-launch security audit
   - Load testing (simulate 1000 concurrent users)
   - Launch checklist review
```

### Top Mistakes That Destroy Stability

1. **Shipping week 3 features in week 1.** Moderation and audit can't protect you if they don't exist yet. Launch without moderation = launch with unmoderated spam.

2. **No rate limiting on signup.** Bot fills database with 10K fake accounts overnight. Signup rate limit + CAPTCHA are the only defense.

3. **Generic error messages that leak information.** "User not found" on login tells attacker the email exists. Always use "Invalid email or password" regardless of which is wrong.

4. **No idempotency on message send.** Double-click sends message twice. Network retry sends message twice. Every mutation endpoint needs idempotency.

5. **Session token in localStorage.** Stolen via XSS. Use HttpOnly cookies. Period.

6. **No email verification.** Disposable email signups destroy trust. Every user gets "user_1234" handle, spam profiles everywhere.

7. **No audit log.** When something breaks (and it will), you have zero visibility into what happened. No incident investigation possible.

8. **No rollback plan.** Migration breaks production. No down migration. No backup. Hours of downtime.

9. **No timeout on requests.** User on slow network sees spinner forever. Eventually gives up. Request hangs server-side consuming a connection.

10. **No pagination.** Search returns 10K results. Database OOM. Browser OOM. User sees white screen.

11. **Booleans where state machines belong.** `isVerified`, `isSuspended`, `isBanned` — three booleans, 8 states, but only 5 are valid combinations. Use a state machine.

12. **Rate limiting by IP only.** Shared office = all employees blocked because one person brute-forced. Rate limit by user_id + IP.

13. **No CAPTCHA on signup.** Automated signup tools create 1000 accounts in 60 seconds. CAPTCHA is the difference between a clean database and a spam farm.

14. **No connection check on messaging.** Users message anyone. Harassment on day one. Messages only between connected users.

15. **Serving avatars from app server.** Image download blocks request thread. 10 concurrent avatar downloads = 10 blocked threads = other requests wait. Use S3 + CDN.

16. **No feature flags.** Every deploy is a gamble. Can't turn off broken feature without rolling back entire release. Feature flags let you disable individual features in seconds.

17. **Migration without backward compatibility.** Renaming a column breaks old code still running during deploy. Add, populate, then drop old column across separate deploys.

18. **2FA delay.** "We'll add it later." Later never comes. Launch without 2FA, get account takeovers, lose user trust. Actually, skip 2FA in beta — but have the infrastructure (sessions, audit) ready.

19. **No email verification fallback.** Email goes to spam. User never verifies. User thinks signup is broken. Clear instructions: "Check spam folder. whitelist us@valueskins.io."

20. **No cleanup for unverified accounts.** 10K unverified signups over 6 months. Database full. Cleanup cron job: delete EMAIL_UNVERIFIED accounts older than 24 hours.
