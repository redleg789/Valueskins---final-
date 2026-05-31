import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.cookies.valueskins_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify session
    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const userId = sessionResult.rows[0].user_id;
    const { display_name, avatar_url } = req.body;

    // Update user table
    const updateResult = await query(
      `UPDATE users SET
        display_name = COALESCE($1, display_name),
        avatar_url = COALESCE($2, avatar_url)
       WHERE id = $3
       RETURNING id, display_name, avatar_url`,
      [display_name || null, avatar_url || null, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = updateResult.rows[0];

    // Also update accounts table if account_id exists
    const userAcctResult = await query(
      'SELECT account_id FROM users WHERE id = $1',
      [userId]
    );

    if (userAcctResult.rows[0]?.account_id) {
      await query(
        `UPDATE accounts SET
          display_name = COALESCE($1, display_name),
          avatar_url = COALESCE($2, avatar_url)
         WHERE id = $3`,
        [display_name || null, avatar_url || null, userAcctResult.rows[0].account_id]
      );
    }

    return res.status(200).json({
      data: {
        id: updatedUser.id,
        display_name: updatedUser.display_name,
        avatar_url: updatedUser.avatar_url,
      },
    });
  } catch (error) {
    console.error('Account update error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
