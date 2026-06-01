import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { brandValueSkin, limit = 20 } = req.query;
    if (!brandValueSkin) return res.status(400).json({ error: 'Value skin required' });

    const result = await query(
      `SELECT id, display_name, avatar_url, bio FROM users u
       JOIN creator_skins cs ON u.id = cs.user_id
       WHERE cs.value_skin = $1 AND u.is_deleted = FALSE
       LIMIT $2`,
      [brandValueSkin, Math.min(Number(limit), 100)]
    );

    return res.status(200).json({ creators: result.rows });
  } catch (error) {
    console.error('Match error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
