import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId } = req.query;
    if (!dealId) return res.status(400).json({ error: 'Deal ID required' });

    const dealResult = await query('SELECT * FROM deals WHERE id = $1', [dealId]);
    if (!dealResult.rows[0]) return res.status(404).json({ error: 'Deal not found' });

    const messagesResult = await query(
      'SELECT * FROM deal_messages WHERE deal_id = $1 ORDER BY created_at ASC',
      [dealId]
    );

    return res.status(200).json({
      deal: dealResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (error) {
    console.error('Get deal error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
