import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { creatorId } = req.query;

    if (!creatorId || typeof creatorId === 'object') {
      return res.status(400).json({ error: 'Invalid creatorId' });
    }

    const parsedId = parseInt(creatorId as string, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: 'Invalid creatorId' });
    }

    // Verify creator exists
    const creatorCheck = await query(
      'SELECT id FROM users WHERE id = $1',
      [parsedId]
    );

    if (creatorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Get all events where creator is tagged
    const eventsResult = await query(
      `SELECT
        e.id, e.title, e.event_date, e.status,
        e.description, e.location, e.attendee_count,
        a.display_name as host_name, a.avatar_url as host_avatar,
        e.tagged_creators
      FROM events e
      LEFT JOIN accounts a ON e.host_id = a.id
      WHERE e.tagged_creators @> $1::jsonb
      ORDER BY e.event_date DESC`,
      [JSON.stringify([{ creatorId: parsedId }])]
    );

    const events = eventsResult.rows.map((row: any) => {
      // Extract this creator's role from tagged_creators
      const taggedCreators = Array.isArray(row.tagged_creators) ? row.tagged_creators : [];
      const thisCreatorTag = taggedCreators.find((t: any) => t.creatorId === parsedId);

      return {
        id: row.id,
        title: row.title,
        eventDate: row.event_date,
        status: row.status,
        description: row.description,
        location: row.location,
        attendeeCount: row.attendee_count,
        hostName: row.host_name,
        hostAvatar: row.host_avatar,
        role: thisCreatorTag?.role || 'performer',
        taggedAt: thisCreatorTag?.taggedAt,
      };
    });

    return res.status(200).json({
      creator: {
        id: parsedId,
        eventCount: events.length,
      },
      events,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[creator-history] Error:', {
      method: req.method,
      creatorId: req.query?.creatorId,
      message: err.message,
    });
    return res.status(500).json({ error: 'Failed to fetch creator event history' });
  }
}
