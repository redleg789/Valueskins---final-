import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const { dealId } = req.query;
      if (!dealId) return res.status(400).json({ error: 'Deal ID required' });

      const result = await query(
        `SELECT deal_id, status, amount, payment_date, payment_method, transaction_id
         FROM deal_payments 
         WHERE deal_id = $1
         ORDER BY payment_date DESC`,
        [dealId]
      );

      return res.status(200).json({ payments: result.rows });
    }

    if (req.method === 'POST') {
      const { dealId, amount, paymentDate, status } = req.body;
      if (!dealId || !amount || !paymentDate) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      await query(
        `INSERT INTO deal_payments (deal_id, amount, payment_date, status, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [dealId, amount, paymentDate, status || 'pending']
      );

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Payment tracking error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
