import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.cookies.valueskins_session;

    if (sessionToken) {
      await query(
        'UPDATE auth_sessions SET is_active = FALSE WHERE id = $1',
        [sessionToken]
      );
    }

    res.setHeader('Set-Cookie', 'valueskins_session=; HttpOnly; Path=/; Max-Age=0');

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
