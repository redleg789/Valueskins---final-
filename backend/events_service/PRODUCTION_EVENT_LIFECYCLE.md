# ValueSkins Event Lifecycle + Intelligence System

## 1. Architecture

Public behavior is ephemeral. Internal intelligence is permanent.

- `events` remains the operational source of truth.
- Public lifecycle is controlled by `visibility_status`, `public_expires_at`, and per-surface visibility flags.
- Archive snapshots land in `archived_events`.
- Cold retention metadata lands in `cold_storage_events`.
- Behavioral intelligence is captured in `event_interaction_events`, `event_conversion_attribution`, `event_attendee_intelligence`, and `event_relationship_edges`.
- Aggregated warehouse-style facts land in `event_analytics_daily`.
- Reports and AI-style insight outputs land in `event_report_runs` and `event_report_insights`.

## 2. Database Schema

Implemented in:

- [20250103000000_event_lifecycle_intelligence.sql](/Users/sakethvelamuri/Desktop/Startups.%20/Short%20term/Valueskins./backend/migrations/20250103000000_event_lifecycle_intelligence.sql)

Key additions:

- lifecycle columns on `events`
- permanent archive tables
- behavioral event streams
- daily analytics rollups
- reporting tables
- admin materialized views for category, city, host, and network overlap

## 3. Storage Design

Hot storage:

- `events` rows where `storage_tier='hot'`
- `is_publicly_listed=TRUE`
- OpenSearch / recommendation / feed surfaces stay enabled

Warm storage:

- `storage_tier='warm'`
- ended events still retained in primary Postgres
- public visibility can be either `ended_visible` or `archived`
- optimized for recent analysis and low-latency operational queries

Cold storage:

- `storage_tier='cold'`
- snapshot tracking in `cold_storage_events`
- intended to pair with compressed object storage blobs and analytics warehouse export

## 4. Archive Strategy

Lifecycle path:

1. event is live
2. event ends
3. worker marks it `ended_visible`
4. after 7 days, worker marks it `archived`
5. public flags are disabled
6. attendee lists become non-public
7. search index is marked `pending_removal`
8. archive snapshots are written
9. after 30 days archived data is promoted to cold retention

The public page can still return an archival message, but discovery, feeds, host surfaces, and attendee surfaces should stop surfacing the event.

## 5. Migration Workers

Implemented worker scaffold:

- [event_lifecycle_worker.rs](/Users/sakethvelamuri/Desktop/Startups.%20/Short%20term/Valueskins./backend/shared/src/workers/event_lifecycle_worker.rs)

Responsibilities:

- mark recently ended events as warm / ended-visible
- archive expired public events
- snapshot archived rows
- promote warm to cold
- roll up daily analytics
- refresh admin views
- schedule weekly/monthly report runs

## 6. Analytics Pipeline

Raw capture tables:

- `event_interaction_events`
- `event_conversion_attribution`
- `event_attendee_intelligence`
- `event_relationship_edges`

Aggregated table:

- `event_analytics_daily`

Recommended production flow:

1. application emits raw interaction rows synchronously or via outbox
2. stream/batch worker enriches role and demographic metadata
3. daily rollup job compacts raw rows into `event_analytics_daily`
4. warehouse export copies `event_analytics_daily` and archive snapshots to low-cost analytics storage

## 7. Admin Dashboard

Ready-to-query materialized views:

- `admin_event_category_performance`
- `admin_event_city_performance`
- `admin_event_host_performance`
- `admin_event_network_overlap`

These support:

- top categories
- best conversion event types
- city performance
- host performance
- repeat co-attendance maps

## 8. Reporting Engine

Reporting tables:

- `event_report_runs`
- `event_report_insights`

Worker responsibility:

- create weekly/monthly runs
- downstream job fills `summary` and inserts ranked insights

Suggested generated outputs:

- strongest repeat-attendance categories
- collaboration-heavy event mixes
- weak-performing event patterns
- growth opportunities by city and tag

## 9. Cost Optimization Strategy

- hot footprint is reduced by turning off search/discovery/profile/feed visibility after expiry
- archived attendee lists are hidden to avoid unnecessary fanout queries
- search index cleanup is driven by `search_index_status`
- warm/cold promotion reduces active-query pressure on old events
- analytics are compacted into daily grains
- cold snapshots can be compressed and moved to object storage
- materialized views avoid repeated expensive admin aggregations

## 10. Implementation-Ready Production System

Code touched:

- lifecycle schema
- event service public filtering
- archive-aware event response shaping
- lifecycle worker scaffold
- admin analytics views

Next production integrations:

1. wire OpenSearch deletion on `search_index_status='pending_removal'`
2. emit interaction rows from frontend/backend event touchpoints
3. add admin endpoints over the materialized views
4. add report generation worker that writes natural-language insights into `event_report_insights`
5. export cold snapshots to warehouse/object storage
