import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface ActivityHistoryEntry {
  id: number;
  userId: number;
  activityType: string;
  entityId: number | null;
  entityType: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  activityDate: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '20');

  const userId = parseInt(id as string);

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  const offset = (page - 1) * limit;

  try {
    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM user_activity_history WHERE user_id = $1',
      [userId]
    );

    const totalCount = parseInt(countResult.rows[0]?.count || '0');

    // Get paginated activities
    const result = await query(
      `SELECT
        id,
        user_id as "userId",
        activity_type as "activityType",
        entity_id as "entityId",
        entity_type as "entityType",
        description,
        metadata,
        activity_date as "activityDate"
      FROM user_activity_history
      WHERE user_id = $1
      ORDER BY activity_date DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      activities: result.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching activity history:', error);
    res.status(500).json({ error: 'Failed to fetch activity history' });
  }
}
