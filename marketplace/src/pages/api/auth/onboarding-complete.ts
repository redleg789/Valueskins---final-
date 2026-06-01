import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db-pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { role } = req.body;

    // Update onboarding_stage to 'complete'
    await query(
      'UPDATE users SET onboarding_stage = $1 WHERE id = $2',
      ['complete', userId]
    );

    // If role is provided, update it too
    if (role) {
      await query(
        'UPDATE users SET role = $1 WHERE id = $2',
        [role, userId]
      );
    }

    return res.status(200).json({ success: true, message: 'Onboarding completed' });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}
