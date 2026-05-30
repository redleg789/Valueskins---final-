import type { NextApiRequest, NextApiResponse } from 'next';
import { backendClient } from '@/lib/backend-client';

/**
 * Deal Structure Builder Proxy (Revenue Protection #9, #10, #17, #22, #23)
 * Proxies to Rust backend at localhost:8080
 * - Mandatory deal structure (prevents "trial collaboration" loophole)
 * - In-platform negotiation with locked revisions
 * - Milestone-based escrow (30-50-20 split)
 * - Application credits/limits (prevents spam)
 * - Negotiation reputation tracking
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.headers['x-user-id']
      ? parseInt(req.headers['x-user-id'] as string, 10)
      : undefined;

    if (req.method === 'POST' && req.body.action === 'create-structure') {
      // Create mandatory deal structure
      const { creator_id, brand_id, title, description, total_value_cents } = req.body;

      if (!creator_id || !brand_id || !title || !total_value_cents) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await backendClient.createDealStructure(
        creator_id,
        brand_id,
        title,
        description || '',
        total_value_cents,
      );

      return res.status(201).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'add-deliverable') {
      // Add deliverable to deal
      const { deal_id, name, description } = req.body;
      if (!deal_id || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await backendClient.addDeliverable(deal_id, name, description || '');
      return res.status(201).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'propose-negotiation') {
      // Propose deal negotiation
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const { deal_id, change_field, proposed_value } = req.body;
      if (!deal_id || !change_field) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await backendClient.proposeDealNegotiation(
        deal_id,
        userId,
        change_field,
        proposed_value,
      );

      return res.status(201).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'lock-deal') {
      // Lock deal structure
      const { deal_id } = req.body;
      if (!deal_id) {
        return res.status(400).json({ error: 'Missing deal_id' });
      }

      const result = await backendClient.lockDealStructure(deal_id);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Deal builder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
