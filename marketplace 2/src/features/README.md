# Feature Boundaries

`src/features/valueskins/core`
- The reusable ValueSkins technology layer.
- Owns identity stickers, credential presentation, store-facing primitives, realtime deal state, and sync hooks.
- Should remain platform-agnostic so it can be mounted on Instagram, YouTube, TikTok, LinkedIn, or a custom marketplace shell.

`src/features/marketplace`
- The COLLABS workflow — marketplace product layer built on ValueSkins core.
- Owns marketplace-specific screens, campaign browsing, creator-brand matching, and app-route composition.

`src/features/events/`
- The EVENTS workflow — event creation, management, and live operations.
- Owns EventManagementPage orchestrator, 25 UI components (ticketing, check-in, chat, safety, analytics, command center, efficiency subsystems), types & mock data, and 3 architecture plans.
- Subdirectory: `components/` (all UI), `data/` (types, mock-data, hooks), `plans/` (PLAN*.md docs).
- API proxy: `pages/api/events/`, `pages/api/business-profiles/`, `pages/api/event-os/`, `pages/api/efficiency/`.

Compatibility shims remain in older `src/components`, `src/lib`, and `src/pages` paths so refactors can happen incrementally without breaking routes or imports.
