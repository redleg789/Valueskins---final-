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

    const session = await queryOne(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );

    if (!session) {
      return res.status(401).json({ error: 'Session invalid' });
    }

    const { display_name } = req.body;
    if (!display_name || typeof display_name !== 'string') {
      return res.status(400).json({ error: 'Display name required' });
    }

    await query(
      'UPDATE users SET display_name = $1 WHERE id = $2',
      [display_name.trim(), session.user_id]
    );

    return res.status(200).json({ success: true, display_name });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}
