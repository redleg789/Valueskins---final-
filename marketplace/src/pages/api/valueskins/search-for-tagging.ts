import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[search-for-tagging] request:', req.method, req.query);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  const searchTerm = (q as string || '').trim().toLowerCase();
  console.log('[search-for-tagging] searchTerm:', searchTerm);

  if (!searchTerm || searchTerm.length < 2) {
    console.log('[search-for-tagging] search term too short, returning empty');
    return res.status(200).json({ results: [] });
  }

  try {
    const results = await query(
      `SELECT
        us.valueskin_code,
        us.id as valueskin_id,
        u.id as user_id,
        u.display_name,
        u.username,
        p.name as profession_name,
        p.category as profession_category,
        u.avatar_url
       FROM user_stickers us
       JOIN users u ON us.user_id = u.id
       JOIN professions p ON us.profession_id = p.id
       WHERE us.is_active = TRUE
       AND (LOWER(us.valueskin_code) LIKE $1
            OR LOWER(p.name) LIKE $1
            OR LOWER(u.display_name) LIKE $1)
       ORDER BY us.created_at DESC
       LIMIT 20`,
      [`%${searchTerm}%`]
    );

    return res.status(200).json({
      results: results.rows.map(row => ({
        valueskinCode: row.valueskin_code,
        valueskinId: row.valueskin_id,
        userId: row.user_id,
        displayName: row.display_name,
        username: row.username,
        professionName: row.profession_name,
        professionCategory: row.profession_category,
        avatarUrl: row.avatar_url,
      })),
    });
  } catch (err: any) {
    console.error('Valueskin search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
}
