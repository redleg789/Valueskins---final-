# PLAN4: ValueSkins Event OS — Intelligence, Network & Retention Systems

**Goal**: Build the missing systems that make ValueSkins an Event Operating System, not just a ticket seller. Compete with BookMyShow (transaction layer) and District (listing layer) by owning **audiences, relationships, and community persistence**.

**Strategic bet**: Events end. Communities survive. Venues choose ValueSkins because we help them compound audiences over time.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  Matching │ Intel │ Graph │ Connections │ Loyalty │ CRM  │
│  Memory │ Community │ Reputation │ Admin │ Recommend    │
├─────────────────────────────────────────────────────────┤
│                   API PROXY (in-memory)                  │
│    /api/intelligence/*  /api/network/*  /api/loyalty/*   │
│    /api/admin/*         /api/reputation/*                │
├─────────────────────────────────────────────────────────┤
│                     RENDER POSTGRES                      │
│  network_edges │ loyalty_points │ host_crm_segments      │
│  event_memories │ communities │ reputation_scores         │
└─────────────────────────────────────────────────────────┘
```

---

## 1. AI ATTENDEE MATCHING ENGINE

**Purpose**: "People You Should Meet" at events — surface relevant connections.

**Logic**:
- Score each pair of attendees at same event by:
  - Interest overlap (tags, communities, professions)
  - Network proximity (mutual follows, same communities)
  - Attendance co-occurrence (been at same past events)
  - Goal alignment (founder↔investor, DJ↔club owner)
- Filter: exclude already-connected users
- Rank: confidence score 0–100
- Cold start: use profile tags + communities as signal

**DB**: `network_edges` (hyperedges) + in-memory scoring

---

## 2. HOST AUDIENCE INTELLIGENCE

**Purpose**: Tell hosts who their audience is and how to optimize it.

**Data**:
- Role distribution (founders, creators, investors, students)
- Community overlap (which tribes attend together)
- Conversion patterns (which segments buy tickets fastest)
- Historical retention (which segments return)

**Output**: Audience composition report, optimization recommendations

**DB**: `audience_analytics` + live aggregation

---

## 3. NETWORK GRAPH SYSTEM

**Purpose**: Track who knows who, who attends together, who should connect.

**Model**: Weighted hyperedge graph
- Nodes = accounts
- Edges = weighted relationships (co-attendance, mutual follow, community co-membership)
- Weight decays over time (tunable half-life)

**Queries**:
- "Who attended 3+ events with user X?"
- "Which clusters exist in this city?"
- "Show me the network around this DJ"

**DB**: `network_edges` with weight + last_seen

---

## 4. POST-EVENT CONNECTION ENGINE

**Purpose**: After event ends, recommend who to connect with.

**Data**:
- Attendees at same event
- Shared interests + tags
- Mutual connections
- Attendance history overlap

**Features**:
- "People you met" list
- Connection request (DM or follow)
- Save for later
- Future event suggestions based on new connections

**DB**: Uses `network_edges` + `event_connections`

---

## 5. EVENT MEMORY SYSTEM

**Purpose**: Every event gets a living recap that persists.

**Content**:
- Key stats (attendees, check-ins, no-shows, revenue)
- Top communities represented
- Promoter leaderboard
- Most engaged segments
- Photo highlights (if enabled)
- Engagement heatmap (busiest hours)
- Audience composition

**Use**: Post-event share, host portfolio, community growth proof

**DB**: `event_memories`

---

## 6. COMMUNITY PERSISTENCE (TRIBE SYSTEM)

**Purpose**: Events end. Tribes survive.

**Model**:
- Tribe = persistent group around a vibe/genre/location
- Created automatically from recurring event series
- Members: past attendees who opted in
- Features: tribe chat, future event alerts, member roster, growth stats

**Conversion**: "Friday Techno Night" → "Friday Techno Tribe"
- Auto-suggest after 3+ editions
- Host controls tribe name, description, visibility

**DB**: `tribes`, `tribe_members`, `tribe_events`

---

## 7. HOST CRM

**Purpose**: Hosts know their best customers by name.

**Segments**:
- VIP (high spend, high frequency)
- Frequent (attended 3+ events)
- At Risk (attended once, not since)
- Lapsed (no show in 90 days)
- High Spender (top 10% by ticket value)
- Loyal (10+ events)
- No-Shows (missed 2+ events)

**Actions**:
- Segment view with filters
- Manual notes + labels per attendee
- Re-engagement workflows (invite to next event, offer discount)
- Export segment as CSV

**DB**: `host_crm` (segments, notes, labels)

---

## 8. LOYALTY ENGINE

**Purpose**: Reward attendance, build habit.

**Mechanics**:
- Points per attend (base 100, VIP bonus 50, high-spender bonus 200)
- Streaks (3 events in a row = 2x points)
- Badges: "Reliable", "Regular", "VIP", "Legend", "Explorer"
- VIP tiers: Bronze (5 events), Silver (15), Gold (30), Platinum (60)
- Rewards: early access, fee waiver, exclusive events

**DB**: `loyalty_points`, `loyalty_streaks`, `loyalty_badges`, `vip_tiers`

---

## 9. VENUE INTELLIGENCE

**Purpose**: Give clubs/bars data to run better operations.

**Metrics**:
- Occupancy prediction (based on ticket velocity + historical)
- Ticket velocity (sales/day leading to event)
- Repeat attendee %
- Promoter ROI (tickets sold / commission paid)
- Attendance heatmaps (day-of-week, time-of-day)
- Revenue trends (by event, promoter, category)
- Top categories (which genres perform best at this venue)
- No-show rate

**DB**: Reads from existing `events`, `check_ins`, `promoters`, `event_analytics_daily`

---

## 10. ATTENDEE REPUTATION SYSTEM

**Purpose**: Trusted attendees get better access. Risky ones get flagged.

**Score components**:
- No-show rate (-30 per occurrence)
- Late arrival (-10)
- Safety reports (-50 per verified report)
- Reliable attendance (+5 per show-up)
- Host rating (+1 to +5 per positive rating)
- Account age (+0.5 per month)

**Tiers**:
- 80+: Trusted Attendee (VIP badge, early access)
- 50-79: Reliable Guest (standard)
- 20-49: Risk User (flagged for manual review)
- 0-19: Restricted (may require pre-approval)

**Badges**: Reliable (80+), VIP (90+), Trusted Attendee (95+), Risk User (<30)

**DB**: `reputation_scores` (existing, extend), `reputation_badges`

---

## 11. AI EVENT RECOMMENDATIONS

**Purpose**: Surface the right events to the right people.

**Input signals**:
- Past attendance
- Tags/interests
- Community membership
- Network graph (friends attending)
- Venue history
- Time/location proximity

**Output**: Ranked event list per user with explainable reasons

**Cold start**: Recommend by city + broad category, then personalize

**DB**: Existing + `event_recommendation_scores`

---

## 12. ADMIN INTELLIGENCE

**Purpose**: Platform-level view for ValueSkins ops team.

**Metrics**:
- Top categories (by revenue, attendance, growth)
- Most successful communities (engagement, event count, member growth)
- Fastest growing cities (user signups, event creation)
- Relationship clusters (which communities overlap)
- Retention metrics (repeat attendee rate, churn)
- Promoter rankings (by conversion rate, revenue)
- Emerging trends (new categories, rising communities)

**DB**: `admin_dashboard_cache` (materialized daily)

---

## 13. ADVANTAGE SYSTEMS (Competitive moat)

### A. Audience Ownership
Hosts can export: list of attendee emails (with consent), segments, labels, notes.
DB: `host_audience_exports` with audit log.

### B. Built-in Promoter Economy (exists, enhance)
- Leaderboards, performance analytics, automated payouts via payment layer.

### C. Community Persistence (Section 6)
- Event → Tribe conversion is the key differentiator.

### D. Smart Audience Matching (Sections 1 + 2)
- "Your audience has too many creators and not enough investors."

### E. Host CRM + Repeat Infrastructure (Section 7)
- Invite previous attendees, VIP groups, loyalty lists.

### F. Distribution Through People
- Tagged DJs, influencers, promoters, communities create organic loops.

### G. Post-Event Intelligence (Section 5)
- Not just "500 tickets sold" but who attended, who returned, promoter ROI.

---

## DB Schema (New Tables)

```sql
-- Network graph edges (weighted, directed hyperedges)
network_edges (id, source_id, target_id, edge_type, weight, metadata, last_seen, created_at)

-- Tribes (community persistence)
tribes (id, name, description, category, city, cover_photo, host_id, member_count, event_count, created_at)
tribe_members (id, tribe_id, account_id, role, joined_at)
tribe_events (id, tribe_id, event_id, added_at)

-- Event memories (recaps)
event_memories (id, event_id, summary, stats_json, audience_composition, promoter_leaderboard, photo_highlights, engagement_heatmap, created_at)

-- Host CRM
host_crm_segments (id, host_id, name, description, filter_criteria_json, created_at)
host_crm_notes (id, host_id, attendee_id, note, label, created_at)

-- Loyalty engine
loyalty_points (id, account_id, points, reason, reference_type, reference_id, created_at)
loyalty_streaks (id, account_id, current_streak, longest_streak, last_event_date, created_at)
loyalty_badges (id, account_id, badge_type, badge_name, awarded_at, display_order)
vip_tiers (id, account_id, tier, points_threshold, achieved_at, expires_at)

-- Attendee reputation (extending existing)
reputation_scores (existing - extend with score breakdown)
reputation_badges (id, account_id, badge_type, score_threshold, awarded_at)

-- Event recommendations (cached)
event_recommendation_scores (id, account_id, event_id, score, reason, generated_at)

-- Admin cache
admin_dashboard_cache (id, cache_key, data_json, generated_at, expires_at)

-- Audience ownership
host_audience_exports (id, host_id, exported_at, segment_criteria, row_count, download_url, audit_log)
```

---

## API Routes

Grouped under `/api/intelligence/`:
```
GET  /api/intelligence/matching/:eventId      — People You Should Meet
GET  /api/intelligence/audience/:eventId       — Audience composition
POST /api/intelligence/graph/edges            — Record a graph edge
GET  /api/intelligence/graph/edges/:accountId  — Get user's edges
GET  /api/intelligence/connections/:eventId    — Post-event connection recs
GET  /api/intelligence/memory/:eventId         — Event recap
POST /api/intelligence/memory/:eventId/generate — Generate recap
GET  /api/intelligence/recommendations         — AI event recs for user
```

Grouped under `/api/communities/`:
```
POST /api/communities/tribes                  — Create tribe
GET  /api/communities/tribes                   — List tribes
POST /api/communities/tribes/:id/join          — Join tribe
POST /api/communities/tribes/:id/events        — Link event to tribe
GET  /api/communities/tribes/:id               — Tribe detail
```

Grouped under `/api/crm/`:
```
GET  /api/crm/segments/:hostId                 — List CRM segments
POST /api/crm/segments/:hostId                 — Create segment
POST /api/crm/notes/:hostId/:attendeeId        — Add note
GET  /api/crm/notes/:hostId/:attendeeId        — Get notes
GET  /api/crm/export/:hostId/:segmentId        — Export segment as CSV
```

Grouped under `/api/loyalty/`:
```
GET  /api/loyalty/points/:accountId            — Points balance
POST /api/loyalty/points/award                 — Award points
GET  /api/loyalty/streaks/:accountId           — Streak info
GET  /api/loyalty/badges/:accountId            — Badges earned
GET  /api/loyalty/vip/:accountId               — VIP status
GET  /api/loyalty/leaderboard                  — Top 50 accounts
```

Grouped under `/api/reputation/`:
```
GET  /api/reputation/score/:accountId          — Full score + breakdown
GET  /api/reputation/badges/:accountId         — Reputation badges
```

Grouped under `/api/admin/`:
```
GET  /api/admin/dashboard                      — Platform metrics
GET  /api/admin/trends                         — Emerging trends
GET  /api/admin/retention                      — Retention metrics
```

---

## Component Tree

```
EventManagementPage (existing)
├── Landing (existing)
├── BrowseFlow (existing)
├── EventDetailTabs (existing — add new tabs)
│   ├── MatchingTab         — "People You Should Meet"
│   ├── MemoryTab           — Event recap
│   ├── TribeTab            — Tribe conversion + view
│   ├── LoyaltyTab          — Loyalty dashboard
│   └── ReputationTab       — Trust score + badges
├── HostDashboard (existing — add tabs)
│   ├── AudienceIntelTab    — Audience composition
│   ├── CRMTab              — Attendee management
│   ├── NetworkTab          — Network graph
│   └── VenueIntelTab       — Venue analytics
└── AdminPage (new)
    └── AdminIntelligence   — Platform-wide metrics
```

---

## Implementation Order (highest impact first)

1. **Event Memory System** — Quick win, visible on every event page
2. **Host CRM** — Direct host value, retention driver
3. **Loyalty Engine** — Habit formation, gamification
4. **Attendee Reputation** — Trust layer, risk reduction
5. **Community Persistence (Tribes)** — Key differentiator
6. **Network Graph + Attendee Matching** — Network effects
7. **Post-Event Connections** — Completes the lifecycle
8. **Host Audience Intelligence** — Upsell to venues
9. **Venue Intelligence** — Ops value for clubs
10. **AI Event Recommendations** — Personalization
11. **Admin Intelligence** — Platform ops view

---

## Edge Cases

- **Cold start users**: Recommend by city + category until 3+ events attended
- **Spam tribes**: Hosts must have 3+ events to create tribe; report + moderate
- **Duplicate recs**: Deduplicate by (account_id, event_id) in scores table
- **Privacy**: Users can opt out of matching, graph, and recommendations
- **Deleted users**: Cascade delete graph edges, loyalty, CRM notes
- **Network graph explosion**: Prune edges older than 12 months, weight decay
- **Community abuse**: Tribe creation requires verified host status
- **Graph at scale**: Use Redis for real-time queries, PG for persistence

---

## Production Readiness

- Feature flags for all new systems (toggle per host/account)
- Audit logs on tribe moderation, CRM exports, admin actions
- Rate limiting on AI matching (100 req/min per host)
- Caching: Redis for graph queries (TTL 5 min), admin cache (TTL 1 hour)
- Monitoring: Track tribe growth, loyalty adoption, CRM usage
