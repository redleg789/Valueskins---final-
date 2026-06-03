import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/valueskins/[id] - Fetch specific ValueSkin
 * PUT /api/valueskins/[id] - Update ValueSkin (edit profession, xp, bio, pitch)
 * DELETE /api/valueskins/[id] - Remove ValueSkin
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
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

    // Verify ownership
    const skinResult = await query(
      'SELECT * FROM user_valueskins WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (!skinResult.rows.length) {
      return res.status(404).json({ error: 'ValueSkin not found or not owned by you' });
    }

    const skin = skinResult.rows[0];

    if (req.method === 'GET') {
      return res.status(200).json({
        id: skin.id,
        profession: skin.profession,
        slot: skin.slot,
        xp: parseInt(skin.xp) || 0,
        level: parseInt(skin.level) || 1,
        aboutMe: skin.about_me,
        pitchText: skin.pitch_text,
        pitchVideo: skin.pitch_video,
        createdAt: skin.created_at,
        updatedAt: skin.updated_at,
      });
    }

    if (req.method === 'PUT') {
      const { profession, xp, level, aboutMe, pitchText, pitchVideo } = req.body;

      const updateResult = await query(
        `UPDATE user_valueskins
         SET profession = $1, xp = $2, level = $3, about_me = $4, pitch_text = $5, pitch_video = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          profession || skin.profession,
          xp !== undefined ? xp : skin.xp,
          level !== undefined ? level : skin.level,
          aboutMe !== undefined ? aboutMe : skin.about_me,
          pitchText !== undefined ? pitchText : skin.pitch_text,
          pitchVideo !== undefined ? pitchVideo : skin.pitch_video,
          id,
        ]
      );

      const updated = updateResult.rows[0];

      return res.status(200).json({
        id: updated.id,
        profession: updated.profession,
        slot: updated.slot,
        xp: parseInt(updated.xp),
        level: parseInt(updated.level),
        aboutMe: updated.about_me,
        pitchText: updated.pitch_text,
        pitchVideo: updated.pitch_video,
        updatedAt: updated.updated_at,
      });
    }

    if (req.method === 'DELETE') {
      await query('DELETE FROM user_valueskins WHERE id = $1', [id]);
      return res.status(200).json({ success: true, message: 'ValueSkin deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('ValueSkin detail API error:', err);
    return res.status(500).json({ error: 'Failed to manage ValueSkin' });
  }
}
