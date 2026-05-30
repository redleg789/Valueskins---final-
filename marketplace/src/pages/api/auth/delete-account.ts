import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userIdHeader = req.headers['x-user-id'];
  if (!userIdHeader || typeof userIdHeader !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
  }

  const userId = parseInt(userIdHeader, 10);
  if (isNaN(userId)) {
    return res.status(401).json({ error: 'Invalid user ID' });
  }

  try {
    const { confirmationPhrase } = req.body;

    // Verify user exists
    const userCheck = await query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Require confirmation phrase to prevent accidental deletion
    if (confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT') {
      return res.status(400).json({ error: 'Invalid confirmation phrase' });
    }

    // Delete user data (cascade will handle related records)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    console.log(`[delete-account] User ${userId} permanently deleted their account`);

    return res.status(200).json({
      success: true,
      message: 'Account permanently deleted',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[delete-account] Error:', {
      userId: req.headers['x-user-id'],
      message: err.message,
    });
    return res.status(500).json({ error: 'Failed to delete account' });
  }
}
