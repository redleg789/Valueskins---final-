import type { NextApiRequest, NextApiResponse } from 'next';
import { backendClient } from '@/lib/backend-client';

/**
 * Identity Verification Proxy (Revenue Protection #6, #7, #16)
 * Proxies to Rust backend at localhost:8080
 * - Prevents fake creator accounts (brand impersonation)
 * - Detects multiple accounts from same device/IP
 * - Enforces identity verification before high-value operations
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = req.headers['x-user-id']
      ? parseInt(req.headers['x-user-id'] as string, 10)
      : undefined;

    if (req.method === 'POST' && req.body.action === 'record-fingerprint') {
      // Record device fingerprint
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const result = await backendClient.recordDeviceFingerprint(userId, {
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.socket.remoteAddress || '0.0.0.0',
        canvasFingerprint: req.body.canvas_fingerprint,
        webglFingerprint: req.body.webgl_fingerprint,
        timezone: req.body.timezone,
      });

      return res.status(201).json(result);
    }

    if (req.method === 'GET' && req.query.action === 'identity-status') {
      // Get identity verification status
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const result = await backendClient.getIdentityStatus(userId);
      return res.status(200).json(result);
    }

    if (req.method === 'POST' && req.body.action === 'verify-gate') {
      // Check if user passes identity verification gate
      if (!userId) {
        return res.status(401).json({ error: 'Missing user ID' });
      }

      const result = await backendClient.getIdentityStatus(userId);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Identity verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
