import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';
import { createOrder, verifySignature } from '@/lib/razorpay';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'POST') {
      const { dealId, amount, action } = req.body;
      if (!dealId || !amount || !action) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      if (action === 'create_order') {
        const amountInPaise = Math.round(amount * 100);
        const result = await createOrder({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `escrow_${dealId}`,
          notes: { dealId, purpose: 'escrow_hold' },
        });

        if (result.success) {
          await query(
            `INSERT INTO deal_escrow (deal_id, razorpay_order_id, amount, status, created_at)
             VALUES ($1, $2, $3, 'pending', NOW())`,
            [dealId, result.data.id, amount]
          );
          return res.status(200).json({ orderId: result.data.id, amount: amountInPaise });
        }
        return res.status(400).json({ error: 'Order creation failed' });
      }

      if (action === 'verify_payment') {
        const { orderId, paymentId, signature } = req.body;
        const isValid = await verifySignature(orderId, paymentId, signature);
        
        if (isValid) {
          await query(
            `UPDATE deal_escrow SET status = 'completed', razorpay_payment_id = $1 WHERE razorpay_order_id = $2`,
            [paymentId, orderId]
          );
          return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Invalid signature' });
      }

      if (action === 'release') {
        await query(
          `UPDATE deal_escrow SET status = 'released', released_at = NOW() WHERE deal_id = $1`,
          [dealId]
        );
        return res.status(200).json({ success: true });
      }

      if (action === 'refund') {
        await query(
          `UPDATE deal_escrow SET status = 'refunded', refunded_at = NOW() WHERE deal_id = $1`,
          [dealId]
        );
        return res.status(200).json({ success: true });
      }
    }

    if (req.method === 'GET') {
      const { dealId } = req.query;
      const result = await query(
        `SELECT * FROM deal_escrow WHERE deal_id = $1`,
        [dealId]
      );
      return res.status(200).json({ escrow: result.rows[0] || null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Escrow error:', error);
    return res.status(500).json({ error: 'Escrow operation failed' });
  }
}

export default withApiHandler(handler);
