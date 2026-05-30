import type { NextApiRequest, NextApiResponse } from 'next';

const matches: Record<string, any[]> = {};
const memories: Record<string, any> = {};
const graphEdges: any[] = [];
const connections: Record<string, any[]> = {};
const recScores: Record<string, any[]> = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = Array.isArray(req.query.path) ? req.query.path : [];
  const [resource, ...rest] = path;

  if (!resource) return res.status(400).json({ error: 'No resource specified' });

  const eventId = rest[0] || '';
  const accountId = parseInt(req.query.accountId as string) || 1;

  switch (resource) {
    // ── People You Should Meet ─────────────────────────
    case 'matching': {
      const m = matches[eventId] || [];
      return res.json({ matches: m });
    }

    // ── Audience Intelligence ──────────────────────────
    case 'audience': {
      return res.json({
        totalAttendees: 0,
        roles: [],
        communities: [],
        topSegments: [],
        recommendations: [],
      });
    }

    // ── Network Graph ──────────────────────────────────
    case 'graph': {
      if (rest[0] === 'edges' && rest[1]) {
        return res.json({ edges: graphEdges, total: graphEdges.length });
      }
      if (rest[0] === 'edges' && req.method === 'POST') {
        graphEdges.push({ ...req.body, lastSeen: new Date().toISOString() });
        return res.json({ success: true });
      }
      return res.json({ edges: graphEdges, clusters: [] });
    }

    // ── Post-Event Connections ─────────────────────────
    case 'connections': {
      const c = connections[eventId] || [];
      return res.json({ connections: c });
    }

    // ── Event Memory (Recap) ───────────────────────────
    case 'memory': {
      if (rest[0] && req.method === 'POST') {
        memories[rest[0]] = {
          summary: '',
          stats: { attendees: 0, check_ins: 0, no_shows: 0, revenue_cents: 0, tickets_sold: 0, avg_rating: 0 },
          audienceComposition: {},
          promoterLeaderboard: [],
          topCommunities: [],
          engagementHeatmap: [],
          generated_at: new Date().toISOString(),
          is_published: false,
        };
      }
      const memory = memories[rest[0] || eventId];
      if (!memory) {
        return res.json(null);
      }
      return res.json(memory);
    }

    // ── Event Recommendations ──────────────────────────
    case 'recommendations': {
      const recs = recScores[accountId] || [];
      return res.json({ recommendations: recs });
    }

    default:
      return res.status(404).json({ error: `Unknown resource: ${resource}` });
  }
}
