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

    const { title, description, budget, valueSkin, creatorId } = req.body;
    if (!title || !valueSkin || !creatorId) return res.status(400).json({ error: 'Missing fields' });

    const dealId = `deal_${Date.now()}`;

    await query(
      `INSERT INTO deals (id, title, description, budget, value_skin, creator_id, status, phase, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'negotiation', 'awaiting_response', NOW())`,
      [dealId, title, description, budget || 0, valueSkin, creatorId]
    );

    return res.status(200).json({ dealId, valueSkin, message: 'Deal created with value skin' });
  } catch (error) {
    console.error('Deal creation error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
