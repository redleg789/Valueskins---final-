import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    // Load draft
    try {
      const result = await query(
        'SELECT data, role, last_saved_step FROM onboarding_drafts WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No draft found' });
      }

      const draft = result.rows[0];
      return res.status(200).json(draft);
    } catch (err) {
      console.error('Error loading draft:', err);
      return res.status(500).json({ error: 'Failed to load draft' });
    }
  }

  if (req.method === 'POST') {
    // Save draft
    try {
      const { role, data, step } = req.body;

      // Ensure table exists
      await query(`
        CREATE TABLE IF NOT EXISTS onboarding_drafts (
          user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          data JSONB NOT NULL,
          last_saved_step TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Upsert draft
      await query(
        `INSERT INTO onboarding_drafts (user_id, role, data, last_saved_step, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
         role = EXCLUDED.role,
         data = EXCLUDED.data,
         last_saved_step = EXCLUDED.last_saved_step,
         updated_at = NOW()`,
        [userId, role, JSON.stringify(data), step]
      );

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error saving draft:', err);
      return res.status(500).json({ error: 'Failed to save draft' });
    }
  }

  if (req.method === 'DELETE') {
    // Delete draft
    try {
      await query(
        'DELETE FROM onboarding_drafts WHERE user_id = $1',
        [userId]
      );
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error deleting draft:', err);
      return res.status(500).json({ error: 'Failed to delete draft' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
