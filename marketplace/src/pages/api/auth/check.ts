import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sessionToken = req.cookies.valueskins_session;

    if (!sessionToken) {
      return res.status(401).json({ authenticated: false });
    }

    const result = await query(
      'SELECT user_id, is_active, expires_at FROM auth_sessions WHERE id = $1',
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ authenticated: false });
    }

    const session = result.rows[0];
    const expiresAt = new Date(session.expires_at);

    if (!session.is_active || expiresAt < new Date()) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({ authenticated: true, user_id: session.user_id });
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ authenticated: false, error: 'Server error' });
  }
}
