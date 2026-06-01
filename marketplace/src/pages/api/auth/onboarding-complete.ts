import { NextApiRequest, NextApiResponse } from 'next';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    // Set user role to creator to activate valueskin module
    await query(
      'UPDATE users SET role = $1 WHERE id = $2',
      ['creator', userId]
    ).catch(() => {});

    return res.status(200).json({ success: true, message: 'Onboarding completed' });
  } catch (error) {
    console.error('Onboarding error:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}
