import { NextApiRequest, NextApiResponse } from 'next';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;

  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    if (req.method === 'POST') {
      const { role, data, step } = req.body;

      const draftKey = `onboarding_${role}_${userId}`;

      await query(
        `INSERT INTO cache (key, value, expires_at) 
         VALUES ($1, $2, NOW() + INTERVAL '7 days')
         ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = NOW() + INTERVAL '7 days'`,
        [draftKey, JSON.stringify({ role, data, step, savedAt: new Date() })]
      ).catch(() => {
        return { rows: [] };
      });

      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
      const role = req.query.role || 'creator';
      const draftKey = `onboarding_${role}_${userId}`;

      const result = await query('SELECT value FROM cache WHERE key = $1', [draftKey]).catch(() => ({
        rows: [],
      }));

      if (result.rows.length > 0) {
        const draft = JSON.parse(result.rows[0].value);
        return res.status(200).json(draft);
      }

      return res.status(404).json({ error: 'No draft found' });
    }

    if (req.method === 'DELETE') {
      const draftKey = `onboarding_creator_${userId}`;
      await query('DELETE FROM cache WHERE key = $1', [draftKey]).catch(() => {});
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Draft error:', error);
    return res.status(500).json({ error: 'Failed to handle draft' });
  }
}
