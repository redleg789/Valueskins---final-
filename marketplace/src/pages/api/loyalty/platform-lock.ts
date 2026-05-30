import type { NextApiRequest, NextApiResponse } from 'next';
import { backendClient } from '@/lib/backend-client';

/**
 * Platform Lock-In Proxy (Revenue Protection #13, #28, #29, #30)
 * Proxies to Rust backend at localhost:8080
 * - Loyalty tiers with exclusive benefits
 * - Deal streak rewards
 * - Reputation portability lock (ratings/status only inside platform)
 * - Creator tools monetization (keeps creators on platform)
 * - 7-Level system tied to platform history
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.headers['x-user-id']
      ? parseInt(req.headers['x-user-id'] as string, 10)
      : undefined;

    if (req.method === 'GET' && req.query.action === 'user-level') {
      // Get user level
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const result = await backendClient.getUserLevel(userId);
      return res.status(200).json(result);
    }

    if (req.method === 'GET' && req.query.action === 'loyalty-status') {
      // Get loyalty status
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const result = await backendClient.getLoyaltyStatus(userId);
      return res.status(200).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'subscribe-tool') {
      // Subscribe to creator tools
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const { tool_type } = req.body;
      if (!tool_type) {
        return res.status(400).json({ error: 'Missing tool_type' });
      }

      const result = await backendClient.subscribeToCreatorTool(userId, tool_type);
      return res.status(201).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Loyalty platform lock error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
