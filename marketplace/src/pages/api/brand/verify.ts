import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;

  if (req.method === 'POST') {
    try {
      const { brandId, brandEmail, businessRegFile } = req.body;
      if (!brandId || !brandEmail) return res.status(400).json({ error: 'Missing fields' });

      const domain = brandEmail.split('@')[1];
      await query(
        `INSERT INTO brand_verification (brand_id, email, domain, status, submitted_at)
         VALUES ($1, $2, $3, 'pending', NOW())`,
        [brandId, brandEmail, domain]
      );

      return res.status(200).json({ status: 'pending', message: 'Verification submitted' });
    } catch (error) {
      return res.status(500).json({ error: 'Verification failed' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { brandId } = req.query;
      const result = await query(
        'SELECT status, verified_at FROM brand_verification WHERE brand_id = $1',
        [brandId]
      );
      return res.status(200).json({ verification: result.rows[0] || null });
    } catch (error) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withApiHandler(handler);
