import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { requestType, email } = req.body;

    if (!requestType || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['access', 'export', 'delete'].includes(requestType)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO data_requests (email, request_type, token, expires_at, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (email, request_type) DO UPDATE SET
       token = $3, expires_at = $4, status = 'pending'`,
      [email, requestType, token, expiresAt]
    );

    console.log(`Data request submitted: ${requestType} for ${email}`);

    return res.status(200).json({
      message: 'Request submitted successfully. Check your email for confirmation.',
    });
  } catch (error) {
    console.error('Data request error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function ensureDataRequestsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS data_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      request_type VARCHAR(50) NOT NULL,
      token TEXT NOT NULL UNIQUE,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      UNIQUE(email, request_type)
    )
  `);
}
