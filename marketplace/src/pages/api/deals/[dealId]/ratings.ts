import type { NextApiRequest, NextApiResponse } from 'next';
import { backendClient } from '@/lib/backend-client';

/**
 * Payment-Gated Ratings Proxy (Revenue Protection #5, #8, #20, #21)
 * Proxies to Rust backend at localhost:8080
 * - Ratings only after payment completion + deliverable verification
 * - Escrow release tied to deliverable acceptance
 * - Automatic payout deadlines (7 days max)
 * - Prevents false completion claims
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { dealId } = req.query;
  const dealIdNum = parseInt(dealId as string, 10);

  if (isNaN(dealIdNum)) {
    return res.status(400).json({ error: 'Invalid deal ID' });
  }

  try {
    const userId = req.headers['x-user-id']
      ? parseInt(req.headers['x-user-id'] as string, 10)
      : undefined;

    if (req.method === 'GET' && req.query.action === 'can-rate') {
      // Check rating gates
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const result = await backendClient.checkRatingGates(dealIdNum, userId);
      return res.status(200).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'submit') {
      // Submit rating
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const { score, review } = req.body;
      if (!score || score < 1 || score > 5) {
        return res.status(400).json({ error: 'Invalid score (1-5)' });
      }

      const result = await backendClient.submitRating(dealIdNum, userId, score, review);
      return res.status(201).json(result);
    }

    if (req.method === 'GET' && req.query.action === 'list') {
      // List ratings for deal
      return res.status(200).json({
        deal_id: dealIdNum,
        ratings: [],
        total: 0,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Ratings error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
