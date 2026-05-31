import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sessionToken = req.cookies.valueskins_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const userId = sessionResult.rows[0].user_id;

    if (req.method === 'GET') {
      const profileResult = await query(
        `SELECT display_name, username, bio, location FROM users WHERE id = $1`,
        [userId]
      );

      if (profileResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(200).json(profileResult.rows[0]);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { display_name, username } = req.body;

      await query(
        `UPDATE users SET display_name = COALESCE($1, display_name), username = COALESCE($2, username), updated_at = NOW() WHERE id = $3`,
        [display_name, username, userId]
      );

      return res.status(200).json({ message: 'Profile updated' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Creator profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
