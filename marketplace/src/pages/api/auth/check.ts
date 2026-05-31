import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sessionToken = req.cookies.valueskins_session;
    console.log('Auth check - Session token:', sessionToken ? 'present' : 'missing');

    if (!sessionToken) {
      console.log('Auth check - No session token in cookies');
      return res.status(401).json({ authenticated: false, reason: 'no_session_token' });
    }

    const result = await query(
      'SELECT user_id, is_active, expires_at FROM auth_sessions WHERE id = $1',
      [sessionToken]
    );

    console.log('Auth check - Session lookup result:', result.rows.length, 'rows');

    if (result.rows.length === 0) {
      console.log('Auth check - Session token not found in database');
      return res.status(401).json({ authenticated: false, reason: 'session_not_found' });
    }

    const session = result.rows[0];
    const expiresAt = new Date(session.expires_at);

    if (!session.is_active || expiresAt < new Date()) {
      console.log('Auth check - Session expired or inactive:', { is_active: session.is_active, expired: expiresAt < new Date() });
      return res.status(401).json({ authenticated: false, reason: 'session_expired' });
    }

    console.log('Auth check - Authenticated user:', session.user_id);
    return res.status(200).json({ authenticated: true, user_id: session.user_id });
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ authenticated: false, error: 'Server error' });
  }
}
