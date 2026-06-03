import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/brand-valueskins - Fetch brand's ValueSkins (categories)
 * POST /api/brand-valueskins - Create brand ValueSkin
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionToken = req.cookies.valueskins_session;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = true AND expires_at > NOW()',
      [sessionToken]
    );

    if (!sessionResult.rows.length) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const userId = sessionResult.rows[0].user_id;

    // Verify user is a brand
    const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows[0]?.role !== 'brand') {
      return res.status(403).json({ error: 'Only brands can access brand ValueSkins' });
    }

    if (req.method === 'GET') {
      const skinsResult = await query(
        `SELECT id, category, slot, xp, level, description, created_at, updated_at
         FROM brand_valueskins WHERE user_id = $1 ORDER BY slot ASC, created_at DESC`,
        [userId]
      );

      const skins = skinsResult.rows.map((skin: any) => ({
        id: skin.id,
        category: skin.category,
        slot: skin.slot,
        xp: parseInt(skin.xp) || 0,
        level: parseInt(skin.level) || 1,
        description: skin.description,
        createdAt: skin.created_at,
        updatedAt: skin.updated_at,
      }));

      return res.status(200).json({ userRole: 'brand', skins, skinCount: skins.length, maxSkins: 3 });
    }

    if (req.method === 'POST') {
      const { category, slot, description } = req.body;

      if (!category || !slot) {
        return res.status(400).json({ error: 'Category and slot are required' });
      }

      const existingResult = await query(
        'SELECT id FROM brand_valueskins WHERE user_id = $1 AND slot = $2',
        [userId, slot]
      );

      if (existingResult.rows.length > 0) {
        return res.status(409).json({ error: `Slot "${slot}" is already occupied` });
      }

      const insertResult = await query(
        `INSERT INTO brand_valueskins (user_id, category, slot, xp, level, description, created_at)
         VALUES ($1, $2, $3, 0, 1, $4, NOW()) RETURNING id, category, slot, xp, level, description, created_at`,
        [userId, category, slot, description || '']
      );

      const newSkin = insertResult.rows[0];
      return res.status(201).json({
        id: newSkin.id,
        category: newSkin.category,
        slot: newSkin.slot,
        xp: 0,
        level: 1,
        description: newSkin.description,
        createdAt: newSkin.created_at,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Brand ValueSkins API error:', err);
    return res.status(500).json({ error: 'Failed to manage brand ValueSkins' });
  }
}
