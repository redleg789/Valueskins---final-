import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { queryOne, query, transaction } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const session = await queryOne(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );
    if (!session) return res.status(401).json({ error: 'Session expired' });

    const userId = session.user_id;

    // Queue for deletion (30-day grace period)
    await transaction(async (client) => {
      // Check if already queued
      const existing = await client.query(
        'SELECT * FROM deletion_queue WHERE user_id = $1',
        [userId]
      );

      if (existing.rows.length === 0) {
        // Queue for deletion
        await client.query(
          `INSERT INTO deletion_queue (user_id, requested_at, deletion_deadline, status)
           VALUES ($1, NOW(), NOW() + INTERVAL '30 days', 'pending')`,
          [userId]
        );

        // Invalidate all sessions
        await client.query(
          'UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1',
          [userId]
        );

        // Log deletion request
        await client.query(
          `INSERT INTO audit_logs (table_name, operation, user_id, new_values)
           VALUES ('users', 'DELETE_REQUESTED', $1, $2)`,
          [userId, JSON.stringify({ deletion_deadline: '30 days' })]
        );
      }
    });

    // Clear session cookie
    res.setHeader('Set-Cookie', 'valueskins_session=; HttpOnly; Path=/; Max-Age=0');

    return res.status(200).json({
      message: 'Account deletion scheduled. You have 30 days to cancel.',
      cancellation_link: '/account/cancel-deletion',
    });
  } catch (error) {
    console.error('Deletion error:', error);
    return res.status(500).json({ error: 'Deletion failed' });
  }
}

export default withApiHandler(handler, {
  allowedMethods: ['POST'],
  rateLimit: { maxRequests: 1, windowMs: 24 * 60 * 60 * 1000 },
});
