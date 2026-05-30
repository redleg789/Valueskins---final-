import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface EventReview {
  id: number;
  eventId: number;
  reviewerUserId: number;
  reviewerName?: string;
  hostUserId: number;
  rating: number;
  reviewText: string | null;
  hostProfessionalism: number | null;
  eventQuality: number | null;
  overallExperience: number | null;
  createdAt: string;
  updatedAt: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '10');

  const eventId = parseInt(id as string);

  if (!eventId || isNaN(eventId)) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  const offset = (page - 1) * limit;

  try {
    // Verify event exists
    const eventCheck = await query(
      'SELECT id FROM events WHERE id = $1',
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get total review count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM event_reviews WHERE event_id = $1',
      [eventId]
    );

    const totalCount = parseInt(countResult.rows[0]?.count || '0');

    // Get paginated reviews with reviewer info
    const result = await query(
      `SELECT
        er.id,
        er.event_id as "eventId",
        er.reviewer_user_id as "reviewerUserId",
        er.host_user_id as "hostUserId",
        er.rating,
        er.review_text as "reviewText",
        er.host_professionalism as "hostProfessionalism",
        er.event_quality as "eventQuality",
        er.overall_experience as "overallExperience",
        er.created_at as "createdAt",
        er.updated_at as "updatedAt"
      FROM event_reviews er
      WHERE er.event_id = $1
      ORDER BY er.created_at DESC
      LIMIT $2 OFFSET $3`,
      [eventId, limit, offset]
    );

    // Calculate aggregate stats
    const statsResult = await query(
      `SELECT
        COUNT(*) as "totalReviews",
        ROUND(AVG(rating)::numeric, 2)::float as "averageRating",
        ROUND(AVG(host_professionalism)::numeric, 2)::float as "avgProfessionalism",
        ROUND(AVG(event_quality)::numeric, 2)::float as "avgQuality",
        ROUND(AVG(overall_experience)::numeric, 2)::float as "avgExperience"
      FROM event_reviews
      WHERE event_id = $1`,
      [eventId]
    );

    const stats = statsResult.rows[0] || {
      totalReviews: 0,
      averageRating: 0,
      avgProfessionalism: 0,
      avgQuality: 0,
      avgExperience: 0,
    };

    res.json({
      eventId,
      reviews: result.rows,
      stats,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching event reviews:', error);
    res.status(500).json({ error: 'Failed to fetch event reviews' });
  }
}
