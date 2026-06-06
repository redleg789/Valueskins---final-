import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

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
    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = true',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session invalid' });
    }

    const userId = sessionResult.rows[0].user_id;
    const { role } = req.body;

    if (!role || !['brand', 'creator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Save role and mark onboarding complete
    await query(
      'UPDATE users SET role = $1, onboarding_stage = $2 WHERE id = $3',
      [role, 'complete', userId]
    );

    return res.status(200).json({ success: true, role });
  } catch (error) {
    console.error('Onboarding complete error:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}
