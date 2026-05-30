import type { NextApiRequest, NextApiResponse } from 'next';

let tribes: any[] = [
  { id: 'tribe-1', name: 'Friday Techno Tribe', description: 'Weekly techno nights at Club XYZ — the community that never stops dancing.', category: 'Nightlife', city: 'Pune', coverPhotoUrl: '', hostId: 1, memberCount: 89, eventCount: 12, isPublic: true, isVerified: true, tags: ['techno', 'nightlife', 'club'], rules: 'Respect the dance floor. No phones on the floor.', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'tribe-2', name: 'Pune Startup Network', description: 'Founders, investors, and builders shaping Pune startup ecosystem.', category: 'Tech', city: 'Pune', coverPhotoUrl: '', hostId: 2, memberCount: 234, eventCount: 28, isPublic: true, isVerified: true, tags: ['startups', 'founders', 'networking'], rules: 'No sales pitches in general chat.', createdAt: '2026-01-15T00:00:00Z' },
  { id: 'tribe-3', name: 'Rock Tribe', description: 'Indie rock, metal, and everything loud.', category: 'Music', city: 'Bangalore', coverPhotoUrl: '', hostId: 3, memberCount: 156, eventCount: 18, isPublic: true, isVerified: false, tags: ['rock', 'music', 'live'], rules: '', createdAt: '2026-02-10T00:00:00Z' },
  { id: 'tribe-4', name: 'Comedy Collective', description: 'Stand-up lovers and open mic regulars.', category: 'Comedy', city: 'Mumbai', coverPhotoUrl: '', hostId: 4, memberCount: 112, eventCount: 9, isPublic: true, isVerified: false, tags: ['comedy', 'standup', 'open mic'], rules: '', createdAt: '2026-04-05T00:00:00Z' },
];

let tribeMembers: Record<string, number[]> = {
  'tribe-1': [1, 101, 102, 103],
  'tribe-2': [1, 2, 104, 105],
  'tribe-3': [3, 106, 107],
  'tribe-4': [4, 108, 109, 110],
};

let tribeEvents: Record<string, string[]> = {};

function generateId() { return `tribe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = Array.isArray(req.query.path) ? req.query.path : [];
  const [resource, id, action] = path;

  if (!resource) return res.status(400).json({ error: 'No resource specified' });

  switch (req.method) {
    case 'GET': {
      // GET /api/communities/tribes — list tribes
      if (resource === 'tribes' && !id) {
        return res.json({ tribes });
      }
      // GET /api/communities/tribes/:id — tribe detail
      if (resource === 'tribes' && id) {
        const tribe = tribes.find(t => t.id === id);
        if (!tribe) return res.status(404).json({ error: 'Tribe not found' });
        const members = tribeMembers[id] || [];
        const events = tribeEvents[id] || [];
        return res.json({ tribe, members, events });
      }
      return res.status(404).json({ error: 'Not found' });
    }

    case 'POST': {
      // POST /api/communities/tribes — create tribe
      if (resource === 'tribes' && !id) {
        const { name, description, category, city } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        const newTribe = {
          id: generateId(), name, description: description || '', category: category || '',
          city: city || '', coverPhotoUrl: '', hostId: parseInt(req.body.hostId) || 1,
          memberCount: 1, eventCount: 0, isPublic: true, isVerified: false,
          tags: req.body.tags || [], rules: req.body.rules || '',
          createdAt: new Date().toISOString(),
        };
        tribes.push(newTribe);
        tribeMembers[newTribe.id] = [newTribe.hostId];
        return res.json({ tribe: newTribe });
      }
      // POST /api/communities/tribes/:id/join
      if (resource === 'tribes' && id && action === 'join') {
        const accountId = parseInt(req.body.accountId) || 1;
        if (!tribeMembers[id]) tribeMembers[id] = [];
        if (!tribeMembers[id].includes(accountId)) {
          tribeMembers[id].push(accountId);
          const tribe = tribes.find(t => t.id === id);
          if (tribe) tribe.memberCount = tribeMembers[id].length;
        }
        return res.json({ success: true, memberCount: tribeMembers[id].length });
      }
      // POST /api/communities/tribes/:id/events
      if (resource === 'tribes' && id && action === 'events') {
        const { eventId } = req.body;
        if (!tribeEvents[id]) tribeEvents[id] = [];
        if (!tribeEvents[id].includes(eventId)) {
          tribeEvents[id].push(eventId);
          const tribe = tribes.find(t => t.id === id);
          if (tribe) tribe.eventCount = tribeEvents[id].length;
        }
        return res.json({ success: true });
      }
      return res.status(404).json({ error: 'Not found' });
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
