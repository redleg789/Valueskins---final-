import type { NextApiRequest, NextApiResponse } from 'next';
import { queryOne, query } from '@/lib/db-pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user from session
    const session = await queryOne(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );

    if (!session) {
      return res.status(401).json({ error: 'Session invalid' });
    }

    const userId = session.user_id;

    // Delete all user data
    await query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);

    // Clear session cookie
    res.setHeader('Set-Cookie', 'valueskins_session=; HttpOnly; Path=/; Max-Age=0');

    return res.status(200).json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
}
