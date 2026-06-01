import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  const sessionToken = req.cookies.valueskins_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    try {
      const { userId, valueSkin } = req.body;
      if (!userId || !valueSkin) return res.status(400).json({ error: 'Missing' });

      const count = await query('SELECT COUNT(*) as cnt FROM user_value_skins WHERE user_id = $1', [userId]);
      if (count.rows[0].cnt >= 3) return res.status(400).json({ error: 'Max 3 skins' });

      await query(`INSERT INTO user_value_skins (user_id, value_skin, purchased_at) VALUES ($1, $2, NOW())`, [userId, valueSkin]);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      const result = await query('SELECT value_skin, purchased_at FROM user_value_skins WHERE user_id = $1', [userId]);
      return res.status(200).json({ skins: result.rows });
    } catch (error) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withApiHandler(handler);
