import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId, message } = req.body;
    if (!dealId || !message) return res.status(400).json({ error: 'Missing fields' });

    await query(
      `INSERT INTO deal_messages (deal_id, sender_id, message, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [dealId, 'current_user', message]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Message error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
