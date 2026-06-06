import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const result = await query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
    );

    return res.json({
      message: 'Users table columns',
      columns: result.rows.map(r => `${r.column_name} (${r.data_type})`),
      raw: result.rows
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
