import { NextApiRequest, NextApiResponse } from 'next';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const { creatorProfile } = req.body;

    await query(
      `UPDATE users SET 
        profile_data = $1,
        onboarding_completed = TRUE,
        updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify(creatorProfile) || '{}',
        userId,
      ]
    );

    return res.status(200).json({ success: true, message: 'Onboarding completed' });
  } catch (error) {
    console.error('Onboarding error:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}
