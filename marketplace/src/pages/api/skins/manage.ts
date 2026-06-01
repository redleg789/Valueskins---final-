import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { userId, valueSkin } = req.body;
      
      if (!userId || !valueSkin) {
        return res.status(400).json({ error: 'Missing userId or valueSkin' });
      }

      // Check count
      try {
        const count = await query('SELECT COUNT(*) as cnt FROM user_value_skins WHERE user_id = $1', [userId]);
        if (count.rows && count.rows[0]?.cnt >= 3) {
          return res.status(400).json({ error: 'Max 3 skins' });
        }
      } catch (countErr) {
        console.error('Count error:', countErr);
        // Table might not exist yet, continue anyway
      }

      // Insert
      try {
        await query(
          'INSERT INTO user_value_skins (user_id, value_skin, purchased_at) VALUES ($1, $2, NOW())',
          [userId, valueSkin]
        );
        return res.status(200).json({ success: true });
      } catch (insertErr: any) {
        console.error('Insert error:', insertErr);
        if (insertErr.code === '23505') {
          return res.status(400).json({ error: 'Skin already owned' });
        }
        return res.status(500).json({ error: 'Failed to save skin' });
      }
    }

    if (req.method === 'GET') {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      try {
        const result = await query(
          'SELECT value_skin, purchased_at, image_url FROM user_value_skins WHERE user_id = $1 ORDER BY purchased_at DESC',
          [userId]
        );
        return res.status(200).json({ skins: result.rows || [] });
      } catch (selectErr) {
        console.error('Select error:', selectErr);
        return res.status(500).json({ error: 'Failed to fetch skins' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Unhandled error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export default handler;
