import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;

  const sessionToken = req.cookies.valueskins_session;
  if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    try {
      const { parentBrandId, locationName, locationCity, balance } = req.body;
      if (!parentBrandId || !locationName) return res.status(400).json({ error: 'Missing fields' });

      const locationId = `${parentBrandId}_${locationCity}`;
      await query(
        `INSERT INTO brand_locations (location_id, parent_brand_id, name, city, balance, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [locationId, parentBrandId, locationName, locationCity, balance || 0]
      );

      return res.status(200).json({ locationId, message: 'Location created' });
    } catch (error) {
      return res.status(500).json({ error: 'Creation failed' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { parentBrandId } = req.query;
      const result = await query(
        'SELECT location_id, name, city, balance FROM brand_locations WHERE parent_brand_id = $1',
        [parentBrandId]
      );
      return res.status(200).json({ locations: result.rows });
    } catch (error) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withApiHandler(handler);
