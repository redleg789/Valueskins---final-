import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';
import { createTransfer } from '@/lib/razorpay';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId } = req.body;
    if (!dealId) return res.status(400).json({ error: 'Missing deal ID' });

    const escrowResult = await query(
      'SELECT * FROM deal_escrow WHERE deal_id = $1',
      [dealId]
    );

    if (!escrowResult.rows[0]) return res.status(404).json({ error: 'Escrow not found' });

    const escrow = escrowResult.rows[0];

    await createTransfer(escrow.razorpay_order_id, [
      {
        account: 'acct_razorpay_creator',
        amount: escrow.amount * 100 * 0.95,
        currency: 'INR',
      },
    ]);

    await query(
      `UPDATE deal_escrow SET status = 'released', released_at = NOW() WHERE deal_id = $1`,
      [dealId]
    );

    await query(
      `UPDATE deals SET phase = 'completed', completed_at = NOW() WHERE id = $1`,
      [dealId]
    );

    return res.status(200).json({ success: true, message: 'Deal completed and payment released' });
  } catch (error) {
    console.error('Deal completion error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
