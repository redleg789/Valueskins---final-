import type { NextApiRequest, NextApiResponse } from 'next';
import { backendClient } from '@/lib/backend-client';

/**
 * Rate Limiting Proxy (Revenue Protection #4, #15, #27)
 * Proxies to Rust backend at localhost:8080
 * - Prevents bulk scraping of creator database
 * - Detects scraping behavior and velocity attacks
 * - Enforces per-user and per-IP rate limits
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST' && req.body.action === 'check') {
      // Check rate limit for request
      const userId = req.headers['x-user-id']
        ? parseInt(req.headers['x-user-id'] as string, 10)
        : undefined;

      const ipAddress = req.socket.remoteAddress || '0.0.0.0';
      const endpoint = req.body.endpoint || 'unknown';

      const result = await backendClient.checkRateLimit(userId, ipAddress, endpoint);
      return res.status(200).json(result);
    }

    if (req.method === 'GET' && req.query.action === 'status') {
      // Get rate limit status for user
      const userId = parseInt(req.headers['x-user-id'] as string, 10);
      if (isNaN(userId)) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      return res.status(200).json({
        status: 'ok',
        limits: {
          search: '100/hour',
          browse: '50/5min',
          export: '5/day',
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Rate limit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
