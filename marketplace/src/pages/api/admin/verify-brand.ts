import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { brandId, action } = req.body;
    if (!brandId || !action) return res.status(400).json({ error: 'Missing fields' });

    const status = action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'pending';

    await query(
      'UPDATE brand_verification SET status = $1, verified_at = NOW() WHERE brand_id = $2',
      [status, brandId]
    );

    return res.status(200).json({ success: true, status });
  } catch (error) {
    console.error('Brand verification error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
