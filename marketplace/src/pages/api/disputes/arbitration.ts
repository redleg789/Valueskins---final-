import type { NextApiRequest, NextApiResponse } from 'next';
import { backendClient } from '@/lib/backend-client';

/**
 * Dispute Resolution Proxy (Revenue Protection #19, #24, #25, #26)
 * Proxies to Rust backend at localhost:8080
 * - Built-in arbitration system (prevents disputes from destroying trust)
 * - Testimonials only after verified collaborations
 * - High-value insights gated behind transaction history
 * - Analytics hidden until deal intent proven
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.headers['x-user-id']
      ? parseInt(req.headers['x-user-id'] as string, 10)
      : undefined;

    if (req.method === 'POST' && req.body.action === 'open-dispute') {
      // Open dispute
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const { deal_id, dispute_type, claim, evidence_urls } = req.body;
      if (!deal_id || !dispute_type || !claim) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await backendClient.initiateDis(deal_id, userId, dispute_type, claim, evidence_urls);
      return res.status(201).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'resolve-dispute') {
      // Resolve dispute (arbitrator only)
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const { dispute_id, ruling, payout_adjustment } = req.body;
      if (!dispute_id || !ruling) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await backendClient.resolveDispute(dispute_id, userId, ruling, payout_adjustment || 0);
      return res.status(200).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'submit-testimonial') {
      // Submit testimonial
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const { subject_user_id, deal_id, text, rating } = req.body;
      if (!subject_user_id || !deal_id || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await backendClient.submitTestimonial(subject_user_id, deal_id, userId, text, rating);
      return res.status(201).json(result);
    }

    if (req.method === 'GET' && req.query.action === 'feature-access') {
      // Check feature access
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const feature = req.query.feature as string;
      if (!feature) {
        return res.status(400).json({ error: 'Missing feature' });
      }

      const result = await backendClient.checkFeatureAccess(userId, feature);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Dispute resolution error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
