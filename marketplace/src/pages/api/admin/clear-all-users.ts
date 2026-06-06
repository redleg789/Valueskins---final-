import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db-pool';

// DANGER: This endpoint clears ALL users from the database
// Only use for development/testing
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Delete all sessions first
    await query('DELETE FROM auth_sessions');
    
    // Delete all users
    await query('DELETE FROM users');

    return res.status(200).json({ success: true, message: 'All users cleared' });
  } catch (error) {
    console.error('Clear users error:', error);
    return res.status(500).json({ error: 'Failed to clear users' });
  }
}
