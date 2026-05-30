import type { NextApiRequest, NextApiResponse } from 'next';
import { backendClient } from '@/lib/backend-client';

/**
 * Contact Masking Proxy (Revenue Protection #1, #3)
 * Proxies all requests to Rust backend at localhost:8080
 * - Masks creator/brand contact details until deal acceptance
 * - Auto-detects and redacts contact info from messages
 * - Unmasks only after milestone payment
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { roomId } = req.query;
  const roomIdNum = parseInt(roomId as string, 10);

  if (isNaN(roomIdNum)) {
    return res.status(400).json({ error: 'Invalid room ID' });
  }

  try {
    if (req.method === 'POST' && req.body.action === 'filter-message') {
      // Filter message for contact information
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Missing message' });
      }

      const result = await backendClient.filterMessage(roomIdNum, message);
      return res.status(200).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'unmask-contact') {
      // Unmask contact after milestone
      const userId = parseInt(req.headers['x-user-id'] as string, 10);
      if (isNaN(userId)) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const result = await backendClient.unmaskContact(roomIdNum, userId);
      return res.status(200).json(result);
    }

    if (req.method === 'GET') {
      // Get masked contact status
      const result = await backendClient.getMaskingStatus(roomIdNum);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Contact mask error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
