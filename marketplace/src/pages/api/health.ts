import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const dbHealth = await query('SELECT NOW()');
    
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth.rows.length > 0 ? 'connected' : 'disconnected',
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
}
