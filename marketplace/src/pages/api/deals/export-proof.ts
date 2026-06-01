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

    const { dealId } = req.body;
    if (!dealId) return res.status(400).json({ error: 'Deal ID required' });

    // Get deal
    const dealResult = await query('SELECT * FROM deals WHERE id = $1', [dealId]);
    if (!dealResult.rows[0]) return res.status(404).json({ error: 'Deal not found' });

    const deal = dealResult.rows[0];

    // Get all messages
    const messagesResult = await query(
      'SELECT * FROM deal_messages WHERE deal_id = $1 ORDER BY created_at ASC',
      [dealId]
    );

    // Get all payments
    const paymentsResult = await query(
      'SELECT * FROM deal_payments WHERE deal_id = $1 ORDER BY created_at ASC',
      [dealId]
    );

    // Get escrow status
    const escrowResult = await query(
      'SELECT * FROM deal_escrow WHERE deal_id = $1',
      [dealId]
    );

    // Get ratings/reviews
    const reviewsResult = await query(
      'SELECT * FROM deal_reviews WHERE deal_id = $1',
      [dealId]
    );

    const proof = {
      dealId,
      deal: {
        title: deal.title,
        status: deal.status,
        phase: deal.phase,
        createdAt: deal.created_at,
        completedAt: deal.completed_at,
      },
      timeline: [
        { event: 'Deal Created', timestamp: deal.created_at },
        ...messagesResult.rows.map(m => ({ event: `Message: ${m.message}`, timestamp: m.created_at })),
        ...paymentsResult.rows.map(p => ({ event: `Payment: $${p.amount}`, timestamp: p.created_at })),
        ...(deal.completed_at ? [{ event: 'Deal Completed', timestamp: deal.completed_at }] : []),
      ],
      messages: messagesResult.rows,
      payments: paymentsResult.rows,
      escrow: escrowResult.rows[0] || null,
      reviews: reviewsResult.rows,
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="proof_${dealId}.json"`);
    return res.status(200).json(proof);
  } catch (error) {
    console.error('Proof export error:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}

export default withApiHandler(handler);
