import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * POST /api/valueskins/initialize-default
 * Create a default ValueSkin for a newly registered user
 * Called during registration flow
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult.rows[0].role;

    // Check if default already exists
    const existingDefault = await query(
      'SELECT id FROM user_valueskins WHERE user_id = $1 AND is_default = true',
      [userId]
    );

    if (existingDefault.rows.length > 0) {
      return res.status(409).json({ error: 'Default ValueSkin already exists' });
    }

    // Create default ValueSkin
    let newSkin;
    if (userRole === 'brand') {
      const insertResult = await query(
        `INSERT INTO brand_valueskins (user_id, category, slot, xp, level, description, is_default, created_at)
         VALUES ($1, $2, $3, 0, 1, $4, true, NOW())
         RETURNING id, category, slot, xp, level, description, is_default, created_at`,
        [userId, 'Brand', 'profession', 'Brand default category']
      );
      newSkin = insertResult.rows[0];
    } else {
      const insertResult = await query(
        `INSERT INTO user_valueskins (user_id, profession, slot, xp, level, about_me, pitch_text, pitch_video, is_default, created_at)
         VALUES ($1, $2, $3, 0, 1, $4, $5, $6, true, NOW())
         RETURNING id, profession, slot, xp, level, about_me, pitch_text, pitch_video, is_default, created_at`,
        [userId, 'Creator', 'profession', 'Tell your story...', 'Your pitch here', '']
      );
      newSkin = insertResult.rows[0];
    }

    // Log audit entry
    await query(
      `INSERT INTO valueskin_audit_log (user_id, valueskin_id, action, old_values, new_values, changed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, newSkin.id, 'auto_created_on_registration', null, JSON.stringify(newSkin)]
    );

    return res.status(201).json({
      success: true,
      defaultValueSkin: {
        id: newSkin.id,
        name: newSkin.profession || newSkin.category,
        description: newSkin.about_me || newSkin.description,
        pitch: newSkin.pitch_text || '',
        video: newSkin.pitch_video || '',
        xp: newSkin.xp,
        level: newSkin.level,
        isDefault: true,
        createdAt: newSkin.created_at,
      },
    });
  } catch (err: any) {
    console.error('Initialize default ValueSkin error:', err);
    return res.status(500).json({ error: 'Failed to initialize default ValueSkin' });
  }
}
