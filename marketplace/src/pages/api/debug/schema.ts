import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // List all tables
    const tablesResult = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(r => r.table_name);

    // Try to get users table schema
    let usersColumns = [];
    try {
      const columnsResult = await query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      usersColumns = columnsResult.rows;
    } catch (e) {
      usersColumns = [{ error: 'Could not fetch users table columns' }];
    }

    return res.json({
      allTables: tables,
      usersColumns: usersColumns
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
