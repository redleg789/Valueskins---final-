import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { eventId, creatorId, role } = req.body;

    // Validate inputs
    if (!eventId || typeof eventId !== 'number' || eventId <= 0) {
      return res.status(400).json({ error: 'Invalid eventId' });
    }
    if (!creatorId || typeof creatorId !== 'number' || creatorId <= 0) {
      return res.status(400).json({ error: 'Invalid creatorId' });
    }
    if (!role || typeof role !== 'string' || !['dj', 'performer', 'entertainer', 'vendor', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Verify event exists
    const eventCheck = await query(
      'SELECT id, title, event_date FROM events WHERE id = $1',
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Verify creator exists
    const creatorCheck = await query(
      'SELECT id FROM users WHERE id = $1',
      [creatorId]
    );

    if (creatorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Get current tagged_creators
    const currentResult = await query(
      'SELECT tagged_creators FROM events WHERE id = $1',
      [eventId]
    );

    const current = currentResult.rows[0]?.tagged_creators || [];

    // Check if already tagged
    const alreadyTagged = Array.isArray(current) && current.some((t: any) => t.creatorId === creatorId);
    if (alreadyTagged) {
      return res.status(400).json({ error: 'Creator already tagged in this event' });
    }

    // Add new tagged creator
    const newTag = {
      creatorId,
      role,
      taggedAt: new Date().toISOString(),
    };

    const updated = Array.isArray(current) ? [...current, newTag] : [newTag];

    // Update event with new tagged creator
    await query(
      'UPDATE events SET tagged_creators = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updated), eventId]
    );

    return res.status(200).json({
      success: true,
      event: {
        id: eventId,
        taggedCreators: updated,
      },
      message: 'Creator tagged in event',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[tag-creator] Error:', {
      method: req.method,
      eventId: req.body?.eventId,
      creatorId: req.body?.creatorId,
      message: err.message,
    });
    return res.status(500).json({ error: 'Failed to tag creator in event' });
  }
}
