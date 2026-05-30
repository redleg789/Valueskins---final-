# Advanced Creator Search System — Production-Ready Implementation

## Overview

A comprehensive, production-ready search system for finding creators and brands on ValueSkins. Users can search by name, followers (from external platforms), location, interests, skills, and more.

**Key Features:**
- ✅ Selectable options (no free-text only) for consistency
- ✅ Dynamic location data (50k+ world cities via API)
- ✅ Real follower counts from Instagram, TikTok, YouTube, Twitter, LinkedIn, Twitch, Snapchat
- ✅ Automatic follower count syncing (scheduled background jobs)
- ✅ Advanced filtering by multiple criteria
- ✅ Full-text search on bios, interests, skills
- ✅ Faceted search (explore by location, interests, follower ranges)
- ✅ Production-ready architecture

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER ONBOARDING FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Select Role (Creator/Brand)                                  │
│ 2. Choose Location (Auto-complete from 50k+ cities)            │
│ 3. Write Bio (free text)                                        │
│ 4. Select Interests (checkboxes from curated list)             │
│ 5. Select Skills (checkboxes from curated list)                │
│ 6. Connect Social Media (Instagram, TikTok, YouTube, etc.)     │
│    - Platform username                                          │
│    - Current follower count (auto-synced)                      │
│ 7. Final confirmation (collaboration open? y/n)                │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE STORAGE LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│ profile_metadata                 social_media_accounts          │
│ ├─ persona_id                   ├─ persona_id                  │
│ ├─ bio_text                      ├─ platform (Instagram, etc)   │
│ ├─ location_city                 ├─ platform_username           │
│ ├─ location_country              ├─ followers_count ← SYNCED    │
│ ├─ location_country_code         ├─ last_synced_at             │
│ ├─ interests[] (Music, Fashion)  └─ is_verified                │
│ ├─ skills[] (Photography, etc)                                 │
│ ├─ languages[]                   creator_aggregate_stats       │
│ ├─ experience_level              ├─ total_followers (sum)       │
│ ├─ primary_content_type          ├─ platforms_connected (count) │
│ └─ collaboration_openness        ├─ dominant_platform          │
│                                  └─ engagement_score           │
│ search_index                     │                             │
│ ├─ persona_id              follower_sync_history              │
│ └─ search_text (tsvector)  ├─ persona_id                      │
│    [auto-updated via       ├─ platform                        │
│     trigger when profile   ├─ old_count                       │
│     changes]               ├─ new_count                       │
│                            ├─ synced_at                       │
│                            └─ sync_status                     │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│              BACKGROUND SYNC SERVICE (CRON)                     │
├─────────────────────────────────────────────────────────────────┤
│ Every 6 hours:                                                  │
│ 1. Find accounts that need syncing                             │
│ 2. Fetch follower counts from external APIs                    │
│    ├─ Instagram (Meta Graph API)                              │
│    ├─ TikTok (TikTok API)                                     │
│    ├─ YouTube (YouTube Data API)                              │
│    ├─ Twitter (Twitter API v2)                                │
│    ├─ LinkedIn (LinkedIn API)                                 │
│    ├─ Twitch (Twitch API)                                     │
│    └─ Snapchat (Snapchat API)                                │
│ 3. Update follower counts in database                          │
│ 4. Log sync history                                            │
│ 5. Trigger aggregate stats recalculation                       │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ADVANCED SEARCH API                           │
├─────────────────────────────────────────────────────────────────┤
│ GET /api/search/creators?                                      │
│   q=photography                 [full-text search]             │
│   &minFollowers=10000           [minimum followers]            │
│   &maxFollowers=500000          [maximum followers]            │
│   &location=IN                  [country code]                 │
│   &interests=fashion,beauty     [comma-sep interests]          │
│   &skills=photography           [comma-sep skills]            │
│   &experienceLevel=advanced     [beginner/inter/adv/expert]   │
│   &contentType=Reels            [primary content type]        │
│   &collaborationOpen=true       [willing to collab]           │
│   &sort=followers               [followers/recent/engagement] │
│   &page=1                       [pagination]                  │
│   &limit=20                     [results per page]            │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH RESULTS UI                            │
├─────────────────────────────────────────────────────────────────┤
│ [Creator Card]  [Creator Card]  [Creator Card]                 │
│ ├─ Avatar      ├─ Avatar       ├─ Avatar                      │
│ ├─ Name        ├─ Name         ├─ Name                        │
│ ├─ Location    ├─ Location     ├─ Location                    │
│ ├─ Bio         ├─ Bio          ├─ Bio                         │
│ ├─ 125k IG    ├─ 45k TikTok   ├─ 350k YouTube               │
│ ├─ Skills      ├─ Skills       ├─ Skills                      │
│ └─ Match 92%   └─ Match 87%    └─ Match 94%                   │
│                                                                 │
│ [Filters Sidebar]          [Faceted Search]                    │
│ ├─ Follower Range          ├─ Top Locations (facets)         │
│ ├─ Location                ├─ Top Interests (facets)         │
│ ├─ Interests               ├─ Follower Ranges (facets)       │
│ ├─ Skills                  └─ Most Connected Platforms       │
│ └─ Experience Level                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables Created

#### 1. **social_media_accounts**
Stores connections to external social media platforms

```sql
CREATE TABLE social_media_accounts (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT REFERENCES personas(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- instagram, tiktok, youtube, etc.
    platform_username VARCHAR(255),
    platform_user_id VARCHAR(255),
    followers_count BIGINT NOT NULL DEFAULT 0,
    follower_count_last_synced_at TIMESTAMPTZ,
    bio_text TEXT,
    profile_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(persona_id, platform)
);
```

#### 2. **profile_metadata**
Searchable profile information

```sql
CREATE TABLE profile_metadata (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT UNIQUE REFERENCES personas(id),
    bio_text TEXT,
    location_city VARCHAR(255),
    location_country VARCHAR(255),
    location_country_code VARCHAR(2),
    interests TEXT[], -- ['Music', 'Fashion', 'Tech']
    skills TEXT[], -- ['Photography', 'Video Editing']
    languages TEXT[],
    experience_level VARCHAR(50), -- beginner/intermediate/advanced/expert
    primary_content_type VARCHAR(100), -- Reels, Shorts, Long-form, etc.
    audience_age_range VARCHAR(50),
    audience_gender VARCHAR(50),
    collaboration_openness BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. **search_index**
Full-text searchable content (auto-updated via trigger)

```sql
CREATE TABLE search_index (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT UNIQUE REFERENCES personas(id),
    search_text TSVECTOR, -- Combined bio + interests + skills + location
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. **creator_aggregate_stats**
Fast filtering and sorting (auto-updated via trigger)

```sql
CREATE TABLE creator_aggregate_stats (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT UNIQUE REFERENCES personas(id),
    total_followers BIGINT DEFAULT 0, -- Sum of all platforms
    platforms_connected INT DEFAULT 0,
    highest_follower_count BIGINT DEFAULT 0,
    dominant_platform VARCHAR(50), -- Platform with most followers
    engagement_score DECIMAL(5,2) DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. **follower_sync_history**
Track when and what synced

```sql
CREATE TABLE follower_sync_history (
    id BIGSERIAL PRIMARY KEY,
    persona_id BIGINT REFERENCES personas(id),
    platform VARCHAR(50),
    old_count BIGINT,
    new_count BIGINT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) -- success, failed, rate_limited
);
```

---

## API Endpoints

### 1. Location Endpoints

**GET /api/locations/countries**
Returns list of all countries
```json
{
  "countries": [
    { "code": "IN", "name": "India" },
    { "code": "US", "name": "United States" },
    ...
  ],
  "total": 195
}
```

**GET /api/locations/cities?country=IN**
Returns top cities for a country (loaded from world-cities library)
```json
{
  "cities": ["Mumbai", "Delhi", "Bangalore", ...],
  "country": "IN",
  "total": 4000
}
```

**GET /api/locations/search?q=mum&country=IN**
Autocomplete cities with fuzzy matching
```json
[
  { "city": "Mumbai", "country": "India", "countryCode": "IN", "population": 20961472 },
  { "city": "Mumbra", "country": "India", "countryCode": "IN", "population": 89000 }
]
```

### 2. Onboarding Endpoint

**POST /api/auth/onboarding-complete**
Saves complete profile with all metadata and social media accounts
```json
{
  "role": "creator",
  "bio": "Fashion content creator based in Mumbai",
  "location": { "city": "Mumbai", "country": "India", "countryCode": "IN" },
  "interests": ["Fashion", "Beauty", "Lifestyle"],
  "skills": ["Photography", "Video Editing", "Styling"],
  "languages": ["English", "Hindi"],
  "socialMediaAccounts": [
    { "platform": "instagram", "username": "myhandle", "followerCount": 125000 },
    { "platform": "youtube", "username": "mychannel", "followerCount": 45000 }
  ],
  "collaborationOpen": true
}
```

### 3. Search Endpoint

**GET /api/search/creators**

Query Parameters:
- `q`: Full-text search (searches bio, interests, skills, location)
- `minFollowers`, `maxFollowers`: Filter by follower range
- `location`: Country code filter (e.g., 'IN', 'US')
- `interests`: Comma-separated interests to filter
- `skills`: Comma-separated skills to filter
- `experienceLevel`: 'beginner', 'intermediate', 'advanced', 'expert'
- `contentType`: Primary content type (Reels, Shorts, etc.)
- `collaborationOpen`: true/false
- `sort`: 'followers' (default), 'recent', 'engagement'
- `page`: Pagination (1, 2, 3, ...)
- `limit`: Results per page (default 20, max 100)

Response:
```json
{
  "results": [
    {
      "personaId": 123,
      "displayName": "Sarah Chen",
      "bio": "Fashion & lifestyle creator",
      "location": { "city": "Mumbai", "country": "India" },
      "totalFollowers": 145000,
      "dominantPlatform": "instagram",
      "interests": ["Fashion", "Lifestyle", "Beauty"],
      "skills": ["Photography", "Content Creation"],
      "experienceLevel": "advanced",
      "socialMediaAccounts": [
        { "platform": "instagram", "username": "sarahchen", "followersCount": 145000 },
        { "platform": "youtube", "username": "sarahchenofficial", "followersCount": 32000 }
      ],
      "engagementScore": 8.5,
      "matchScore": 95
    }
  ],
  "total": 245,
  "page": 1,
  "pages": 13,
  "hasMore": true,
  "facets": {
    "locations": [
      { "location": "India", "count": 245 },
      { "location": "United States", "count": 182 }
    ],
    "interests": [
      { "interest": "Fashion", "count": 156 },
      { "interest": "Lifestyle", "count": 142 }
    ],
    "followerRanges": [
      { "range": "10k-50k", "count": 234 },
      { "range": "50k-100k", "count": 156 }
    ]
  },
  "timing": { "queryMs": 145 }
}
```

---

## Follower Count Sync Service

### How It Works

1. **Scheduled Job** (every 6 hours)
   - Finds accounts that need syncing (never synced or >6hrs old)
   - Syncs in parallel batches to avoid rate limiting
   - Respects API rate limits with exponential backoff

2. **Platform-Specific Sync**
   - **Instagram**: Meta Graph API `GET /v18.0/{user_id}?fields=followers_count`
   - **TikTok**: TikTok API `GET /v1/user/info/?fields=follower_count`
   - **YouTube**: YouTube Data API `GET /channels?fields=subscriberCount`
   - **Twitter**: Twitter API v2 `GET /users/:id?user.fields=public_metrics`
   - **LinkedIn**: LinkedIn API `GET /me?fields=followerCount`
   - **Twitch**: Twitch API `GET /users/follows?to_id={user_id}`
   - **Snapchat**: Snapchat API `GET /user/profile/` + follower count endpoint

3. **Error Handling**
   - Graceful handling of rate limits (retry with backoff)
   - Log failed syncs with reason
   - Partial failures don't block entire sync job

4. **Database Update**
   - Update `social_media_accounts.followers_count`
   - Update `social_media_accounts.follower_count_last_synced_at`
   - Log to `follower_sync_history` for audit trail
   - Triggers auto-update of `creator_aggregate_stats`

### Setup (Node Cron)

```typescript
import cron from 'node-cron';
import { syncService } from '@/lib/social-media-sync';

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  const accounts = await db.query(`
    SELECT * FROM social_media_accounts
    WHERE is_active = TRUE AND (
      follower_count_last_synced_at IS NULL OR
      follower_count_last_synced_at < NOW() - INTERVAL '6 hours'
    )
  `);

  const tokens = {
    instagram: process.env.INSTAGRAM_ACCESS_TOKEN,
    tiktok: process.env.TIKTOK_ACCESS_TOKEN,
    youtube: process.env.YOUTUBE_API_KEY,
    // ... other tokens
  };

  const results = await syncService.syncAllCreators(accounts, tokens);

  // Log results and update database
  for (const result of results) {
    if (result.status === 'success') {
      await db.query(
        'UPDATE social_media_accounts SET followers_count = $1, follower_count_last_synced_at = NOW() WHERE persona_id = $2 AND platform = $3',
        [result.newCount, result.personaId, result.platform]
      );
    }

    await db.query(
      'INSERT INTO follower_sync_history (persona_id, platform, old_count, new_count, sync_status) VALUES ($1, $2, $3, $4, $5)',
      [result.personaId, result.platform, result.oldCount, result.newCount, result.status]
    );
  }
});
```

---

## Files & Components

### Backend
- `backend/migrations/20260525000001_social_media_search_system.sql` — Database schema
- `marketplace/src/pages/api/locations/countries.ts` — Get all countries
- `marketplace/src/pages/api/locations/cities.ts` — Get cities by country
- `marketplace/src/pages/api/locations/search.ts` — Search/autocomplete locations
- `marketplace/src/pages/api/auth/onboarding-complete.ts` — Save onboarding data
- `marketplace/src/pages/api/search/creators.ts` — Advanced search API
- `marketplace/src/lib/social-media-sync.ts` — Follower sync service

### Frontend
- `marketplace/src/lib/onboarding-data.ts` — Curated lists + API functions
- `marketplace/src/pages/auth/onboarding-enhanced.tsx` — Enhanced onboarding UI
- (TODO) `marketplace/src/pages/discover.tsx` — Search & discovery page

---

## Deployment Checklist

- [ ] Run database migration
- [ ] Set up API credentials (Instagram, TikTok, YouTube, etc.)
- [ ] Deploy location APIs
- [ ] Deploy onboarding endpoint
- [ ] Deploy search API
- [ ] Set up cron job for follower syncing
- [ ] Test end-to-end: onboard creator → sync followers → search & find
- [ ] Monitor sync job for failures
- [ ] Set up alerts for high sync failure rates

---

## Performance Optimizations

1. **Indexing**: Database indexes on frequently filtered fields (followers, location, interests)
2. **Caching**: Cache popular locations and interests in Redis
3. **Full-Text Search**: PostgreSQL GIN indexes for fast text search
4. **Aggregates**: Pre-computed stats (total_followers, platforms_connected) for fast sorting
5. **Batch Operations**: Sync follower counts in batches with delays to avoid rate limiting
6. **Pagination**: Always paginate results (don't return all 10k creators at once)

---

## Testing

```bash
# Test location API
curl 'http://localhost:3000/api/locations/countries'
curl 'http://localhost:3000/api/locations/cities?country=IN'
curl 'http://localhost:3000/api/locations/search?q=mum'

# Test search API
curl 'http://localhost:3000/api/search/creators?q=photography&minFollowers=10000&location=IN'
curl 'http://localhost:3000/api/search/creators?interests=fashion,beauty&sort=followers'

# Test onboarding
curl -X POST 'http://localhost:3000/api/auth/onboarding-complete' \
  -H 'Content-Type: application/json' \
  -d '{ "role": "creator", "bio": "...", ... }'
```

---

## Future Enhancements

- [ ] Machine learning ranking (engagement prediction)
- [ ] Collaborative filtering (similar creators)
- [ ] Saved searches & alerts
- [ ] Export creator lists (for brands)
- [ ] API for third-party integrations
- [ ] Advanced analytics per creator (audience demographics, posting times, etc.)
