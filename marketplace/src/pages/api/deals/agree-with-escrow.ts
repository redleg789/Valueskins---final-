import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';
import { createOrder } from '@/lib/razorpay';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId, amount } = req.body;
    if (!dealId || !amount) return res.status(400).json({ error: 'Missing fields' });

    const amountInPaise = Math.round(amount * 100);

    const orderResult = await createOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `escrow_${dealId}`,
      notes: { dealId, purpose: 'escrow_hold' },
    });

    if (!orderResult.success) return res.status(400).json({ error: 'Order creation failed' });

    await query(
      `UPDATE deals SET phase = 'agreed', phase_updated_at = NOW() WHERE id = $1`,
      [dealId]
    );

    await query(
      `INSERT INTO deal_escrow (deal_id, razorpay_order_id, amount, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())`,
      [dealId, orderResult.data.id, amount]
    );

    return res.status(200).json({ orderId: orderResult.data.id, amount: amountInPaise });
  } catch (error) {
    console.error('Escrow creation error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
