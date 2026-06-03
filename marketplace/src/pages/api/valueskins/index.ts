import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/valueskins - Fetch current user's ValueSkins
 * POST /api/valueskins - Create new ValueSkin
 * 
 * Returns ValueSkins based on user role:
 * - Creator: shows creator profession-based skins
 * - Brand: shows brand category-based skins
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

    // Get user role
    const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    const userRole = userResult.rows[0]?.role || 'creator';

    if (req.method === 'GET') {
      // Fetch all ValueSkins for this user
      const skinsResult = await query(
        `SELECT
          id, user_id, profession, slot, xp, level, about_me, pitch_text, pitch_video,
          created_at, updated_at
         FROM user_valueskins
         WHERE user_id = $1
         ORDER BY slot ASC, created_at DESC`,
        [userId]
      );

      const skins = skinsResult.rows.map((skin: any) => ({
        id: skin.id,
        profession: skin.profession,
        slot: skin.slot, // 'profession', 'passion', 'hobby'
        xp: parseInt(skin.xp) || 0,
        level: parseInt(skin.level) || 1,
        aboutMe: skin.about_me,
        pitchText: skin.pitch_text,
        pitchVideo: skin.pitch_video,
        createdAt: skin.created_at,
        updatedAt: skin.updated_at,
      }));

      return res.status(200).json({
        userRole,
        skins,
        skinCount: skins.length,
        maxSkins: 3, // Can have profession, passion, hobby
      });
    }

    if (req.method === 'POST') {
      const { profession, slot, aboutMe, pitchText, pitchVideo } = req.body;

      // Validation
      if (!profession || !slot) {
        return res.status(400).json({ error: 'Profession and slot are required' });
      }

      if (!['profession', 'passion', 'hobby'].includes(slot)) {
        return res.status(400).json({ error: 'Invalid slot type' });
      }

      // Check if slot is already taken
      const existingResult = await query(
        'SELECT id FROM user_valueskins WHERE user_id = $1 AND slot = $2',
        [userId, slot]
      );

      if (existingResult.rows.length > 0) {
        return res.status(409).json({ error: `Slot "${slot}" is already occupied` });
      }

      // Create ValueSkin
      const insertResult = await query(
        `INSERT INTO user_valueskins (user_id, profession, slot, xp, level, about_me, pitch_text, pitch_video, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id, profession, slot, xp, level, about_me, pitch_text, pitch_video, created_at`,
        [userId, profession, slot, 0, 1, aboutMe || '', pitchText || '', pitchVideo || '']
      );

      const newSkin = insertResult.rows[0];

      return res.status(201).json({
        id: newSkin.id,
        profession: newSkin.profession,
        slot: newSkin.slot,
        xp: 0,
        level: 1,
        aboutMe: newSkin.about_me,
        pitchText: newSkin.pitch_text,
        pitchVideo: newSkin.pitch_video,
        createdAt: newSkin.created_at,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('ValueSkins API error:', err);
    return res.status(500).json({ error: 'Failed to manage ValueSkins' });
  }
}
