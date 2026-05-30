import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const eventIdHeader = req.headers['x-event-id'];
  const userIdHeader = req.headers['x-user-id'];

  if (!eventIdHeader || typeof eventIdHeader !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: Missing event ID' });
  }

  if (!userIdHeader || typeof userIdHeader !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
  }

  const eventId = parseInt(eventIdHeader, 10);
  const userId = parseInt(userIdHeader, 10);

  if (isNaN(eventId) || isNaN(userId)) {
    return res.status(401).json({ error: 'Invalid event or user ID' });
  }

  try {
    // Verify user is host of event
    const eventCheck = await query(
      'SELECT id, host_id, tagged_creators FROM events WHERE id = $1',
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    if (event.host_id !== userId) {
      return res.status(403).json({ error: 'Only event host can manage tags' });
    }

    // Handle different operations
    if (req.method === 'GET') {
      // Get all tagged creators for this event
      const tagged = Array.isArray(event.tagged_creators) ? event.tagged_creators : [];

      return res.status(200).json({
        eventId,
        taggedCount: tagged.length,
        taggedCreators: tagged,
      });
    }

    if (req.method === 'DELETE') {
      // Remove tag
      const { creatorId } = req.body;

      if (!creatorId || typeof creatorId !== 'number') {
        return res.status(400).json({ error: 'Invalid creatorId' });
      }

      const tagged = Array.isArray(event.tagged_creators) ? event.tagged_creators : [];
      const filtered = tagged.filter((t: any) => t.creatorId !== creatorId);

      if (tagged.length === filtered.length) {
        return res.status(404).json({ error: 'Creator not tagged in this event' });
      }

      await query(
        'UPDATE events SET tagged_creators = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(filtered), eventId]
      );

      return res.status(200).json({
        success: true,
        message: 'Creator tag removed',
        taggedCreators: filtered,
      });
    }

    if (req.method === 'PUT') {
      // Update tag role
      const { creatorId, role } = req.body;

      if (!creatorId || typeof creatorId !== 'number') {
        return res.status(400).json({ error: 'Invalid creatorId' });
      }

      if (!role || !['dj', 'performer', 'entertainer', 'vendor', 'staff'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const tagged = Array.isArray(event.tagged_creators) ? event.tagged_creators : [];
      const updated = tagged.map((t: any) =>
        t.creatorId === creatorId ? { ...t, role } : t
      );

      if (JSON.stringify(tagged) === JSON.stringify(updated)) {
        return res.status(404).json({ error: 'Creator not found in tags' });
      }

      await query(
        'UPDATE events SET tagged_creators = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(updated), eventId]
      );

      return res.status(200).json({
        success: true,
        message: 'Tag updated',
        taggedCreators: updated,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[manage-tags] Error:', {
      method: req.method,
      eventId,
      userId,
      message: err.message,
    });
    return res.status(500).json({ error: 'Failed to manage event tags' });
  }
}
