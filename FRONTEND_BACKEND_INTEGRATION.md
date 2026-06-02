# Frontend Backend Integration Guide

**Status**: Ready for real-time sync with Render backend

## Overview

The frontend is now configured to:
1. **Connect to Render backend** for all API calls
2. **Connect to WebSocket** for real-time multi-device sync
3. **Sync changes instantly** when brand/creator update deals/campaigns on different devices
4. **Remove hardcoded data** - everything comes from backend

## Configuration

### Step 1: Set Environment Variables

**For Local Development** (`.env.local`):
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

**For Render Production** (in Vercel Environment Variables):
```
NEXT_PUBLIC_BACKEND_URL=https://your-service.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-service.onrender.com/ws
```

### Step 2: Update Vercel Deployment

1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Add:
   - `NEXT_PUBLIC_BACKEND_URL` = `https://your-render-service.onrender.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://your-render-service.onrender.com/ws`
5. Redeploy

## How Real-time Sync Works

### Scenario: Brand creates campaign on Device A, Creator sees it on Device B

```
Device A (Brand):
  1. POST /api/v1/campaigns (create campaign)
  2. Backend processes, broadcasts to WebSocket
  3. DeviceA receives update via WS, updates local state

Device B (Creator):
  1. Connected to /ws WebSocket
  2. Receives 'campaign_created' event
  3. useRealtimeSync hook catches it
  4. Updates local state immediately
  5. Creator sees new campaign in real-time
```

### New Hooks for Real-time

**`useRealtime(userId)`** - Low-level WebSocket connection
```typescript
const { isConnected, subscribe, send } = useRealtime(userId);

// Subscribe to events
const unsubscribe = subscribe('deal_updated', (msg) => {
  console.log('Deal updated:', msg.data);
});
```

**`useRealtimeSync(userId)`** - Auto-syncs with deal state
```typescript
const { isConnected } = useRealtimeSync(userId);
// Automatically updates deals/campaigns/applications when changes come in
```

## API Endpoints Required (Backend must implement)

The frontend expects these endpoints to exist on the Render backend:

### Creators
```
GET  /api/v1/creators                    # List all creators
GET  /api/v1/creators/:id                # Get creator profile
POST /api/v1/creators                    # Create creator profile
PATCH /api/v1/creators/:id               # Update creator profile
```

### Campaigns
```
GET  /api/v1/campaigns                   # List campaigns
POST /api/v1/campaigns                   # Create campaign
PATCH /api/v1/campaigns/:id              # Update campaign
```

### Deals
```
GET  /api/v1/deals                       # List deals
GET  /api/v1/deals/:id                   # Get deal details
POST /api/v1/deals                       # Create deal room
PATCH /api/v1/deals/:id                  # Update deal (sends WebSocket broadcast)
```

### Messages
```
GET  /api/v1/deals/:dealId/messages      # Get messages in deal room
POST /api/v1/deals/:dealId/messages      # Send message (broadcasts via WS)
```

### Applications
```
GET  /api/v1/applications                # List applications
POST /api/v1/applications                # Create application
PATCH /api/v1/applications/:id           # Update application (broadcasts via WS)
```

## WebSocket Events Broadcast by Backend

When backend creates/updates data, it broadcasts these events to connected WebSocket clients:

```typescript
// When campaign is created
{
  "event_type": "campaign_created",
  "user_id": 0,  // 0 = broadcast to all
  "data": { ...campaign object... },
  "timestamp": "2026-06-02T10:30:00Z"
}

// When deal is updated
{
  "event_type": "deal_updated",
  "user_id": 0,
  "data": {
    "dealKey": "Campaign Title:123",
    "updates": { phase: "chatroom", ... }
  },
  "timestamp": "2026-06-02T10:30:00Z"
}

// When message is sent
{
  "event_type": "message_sent",
  "user_id": 0,
  "data": {
    "dealKey": "Campaign Title:123",
    "message": { ...ChatMessage... }
  },
  "timestamp": "2026-06-02T10:30:00Z"
}
```

## Testing Real-time Sync (2 Devices)

### Setup
1. Open `http://localhost:3000/demo/marketplace` in Tab A
2. Open `http://localhost:3000/demo/marketplace` in Tab B (different window/device if possible)
3. Verify both tabs show "WebSocket Connected" indicator

### Test Scenario 1: Create Campaign
1. **Tab A (Brand)**: Create a campaign
2. **Tab B (Creator)**: Should see new campaign appear in real-time (no refresh needed)
3. **Verify**: Timestamp matches, all fields present

### Test Scenario 2: Update Deal
1. **Tab A**: Click into deal negotiation
2. **Tab A**: Send offer message
3. **Tab B**: Should see message appear immediately in real-time chat
4. **Verify**: No refresh needed, message appears instantly

### Test Scenario 3: Multi-account Sync
1. **Tab A**: Login as `brand@example.com`
2. **Tab B**: Login as `creator@example.com` (different account)
3. **Tab A**: Create campaign
4. **Tab B**: Should show the campaign automatically (not as creator's own campaign, but as available opportunity)

## Debugging Real-time Issues

### Check WebSocket Connection
```javascript
// In browser console:
const realtime = window.__REALTIME_CLIENT__;
console.log('Connected:', realtime?.isConnected());
console.log('Messages received:', realtime?.lastMessage);
```

### Enable Debug Logging
```typescript
// In useRealtime hook, logs appear as "[Realtime]" prefix
// Check browser DevTools Console for connection logs
```

### Network Tab
1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Click on `/ws` connection
4. Check "Messages" tab to see broadcast events

### Backend Logs
```bash
# On Render dashboard, check service logs:
# Look for "[Realtime]" prefix messages
cargo run --release 2>&1 | grep Realtime
```

## Troubleshooting

**"WebSocket connection refused"**
- Verify `NEXT_PUBLIC_WS_URL` is set correctly
- Check Render backend is running (`/health` returns 200)
- Check CORS configuration on backend includes your frontend origin

**"Cannot reach backend API"**
- Verify `NEXT_PUBLIC_BACKEND_URL` is set
- Check backend is deployed and running
- Check firewall allows traffic from Vercel to Render

**"Real-time updates not showing"**
- Check browser console for WebSocket errors
- Verify backend broadcasts events when data changes
- Check that `useRealtimeSync` hook is called in MarketplaceDemoPage

**"Different data on two tabs"**
- Likely a sync issue; refresh to re-sync with backend
- Check localStorage isn't overriding real-time updates
- Verify backend DB is consistent

## Next Steps

1. **Deploy Render backend** (see `RENDER_DEPLOYMENT_GUIDE.md`)
2. **Set environment variables** in Vercel
3. **Test real-time sync** with 2 devices
4. **Enable feature flags** for gradual rollout
5. **Monitor WebSocket connections** on Render dashboard

## Performance Considerations

- WebSocket connections stay open, consuming memory (~1MB per connection)
- Render Standard plan supports ~100 concurrent WebSocket connections
- For 1000+ concurrent users, upgrade to Render Pro ($29/mo) or use load balancer
- Broadcast events only sent to affected users (scoped by room_id or user_id)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Vercel Frontend                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ useRealtime + useRealtimeSync Hooks                  │  │
│  │ Auto-syncs all state changes in real-time            │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────────┘
               │
         ┌─────┴─────────┐
         │               │
      HTTPS             WSS (WebSocket)
    /api/v1/*        /ws broadcasts
         │               │
         └─────┬─────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                   Render Backend                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ API Gateway (Actix-web)                              │  │
│  │ - REST endpoints: /api/v1/*                           │  │
│  │ - WebSocket: /ws (broadcasts real-time events)       │  │
│  │ - Rate limiting, auth, CORS                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Database (PostgreSQL)                                │  │
│  │ - Users, campaigns, deals, messages                  │  │
│  │ - All state persisted and consistent                 │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

**Ready to test?** Deploy Render backend first, then update Vercel env vars, then refresh frontend.
