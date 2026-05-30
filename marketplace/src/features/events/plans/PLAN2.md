# ValueSkins Event OS — Missing Systems Plan

## Architecture Flow

```
QR Ticketing -> Check-In -> Attendance Intelligence
     |               |
     v               v
  Plus-One ----> Arrival Layer ---> Live Chat
     |               |
     v               v
  AI FAQ -------> Trust & Safety ---> Post-Event
                                   |
                                   v
                          Host Command Center
                                   |
                                   v
                           Automation System
```

## Implementation Order (this session)

Phase A: Foundation
1. DB migration (tickets, profiles, check-in, announcements, chat, FAQ, reports, analytics, locations)
2. Types (all new interfaces)
3. API proxy (all 40+ endpoints)
4. QR Ticketing UI (TicketView, validation, wallet buttons)
5. Venue Check-In UI (scan mode, manual lookup, live count)

Phase B: Communication
6. Event Announcements (create, list, pin, push)
7. Temporary Event Chat (send, moderate, archive)
8. AI FAQ Generator (auto-generate + manual edit)

Phase C: Social + Safety
9. Plus-One + Group (invites, join, transfer)
10. Arrival Layer (map, navigation, location unlock)
11. Trust & Safety (SOS, reports, block, security dashboard)

Phase D: Intelligence
12. Attendee Cards (profiles, badges, privacy)
13. Attendance Intelligence (stats, heatmaps, no-shows)
14. Post-Event Layer (ratings, photos, connections)

Phase E: Command + Automation
15. Host Command Center (real-time, demographics, conversions)
16. Automation (reminders, waitlist, follow-ups)
