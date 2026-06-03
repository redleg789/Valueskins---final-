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

      // Prepare new values (using provided or existing)
      const newProfession = profession !== undefined ? profession : skin.profession;
      const newXp = xp !== undefined ? xp : skin.xp;
      const newLevel = level !== undefined ? level : skin.level;
      const newAboutMe = aboutMe !== undefined ? aboutMe : skin.about_me;
      const newPitchText = pitchText !== undefined ? pitchText : skin.pitch_text;
      const newPitchVideo = pitchVideo !== undefined ? pitchVideo : skin.pitch_video;

      // Track changes for audit log
      const changedFields: string[] = [];
      if (profession !== undefined && profession !== skin.profession) changedFields.push('profession');
      if (xp !== undefined && xp !== skin.xp) changedFields.push('xp');
      if (level !== undefined && level !== skin.level) changedFields.push('level');
      if (aboutMe !== undefined && aboutMe !== skin.about_me) changedFields.push('about_me');
      if (pitchText !== undefined && pitchText !== skin.pitch_text) changedFields.push('pitch_text');
      if (pitchVideo !== undefined && pitchVideo !== skin.pitch_video) changedFields.push('pitch_video');

      // Update ValueSkin
      const updateResult = await query(
        `UPDATE user_valueskins
         SET profession = $1, xp = $2, level = $3, about_me = $4, pitch_text = $5, pitch_video = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [newProfession, newXp, newLevel, newAboutMe, newPitchText, newPitchVideo, id]
      );

      const updated = updateResult.rows[0];

      // Log to audit trail if changes were made
      if (changedFields.length > 0) {
        const oldValues = {
          profession: skin.profession,
          xp: skin.xp,
          level: skin.level,
          about_me: skin.about_me,
          pitch_text: skin.pitch_text,
          pitch_video: skin.pitch_video,
        };

        const newValues = {
          profession: newProfession,
          xp: newXp,
          level: newLevel,
          about_me: newAboutMe,
          pitch_text: newPitchText,
          pitch_video: newPitchVideo,
        };

        await query(
          `INSERT INTO valueskin_audit_log (user_id, valueskin_id, action, old_values, new_values, changed_fields, changed_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [userId, id, 'updated', JSON.stringify(oldValues), JSON.stringify(newValues), JSON.stringify(changedFields)]
        );
      }

      return res.status(200).json({
        success: true,
        id: updated.id,
        profession: updated.profession,
        slot: updated.slot,
        xp: parseInt(updated.xp),
        level: parseInt(updated.level),
        aboutMe: updated.about_me,
        pitchText: updated.pitch_text,
        pitchVideo: updated.pitch_video,
        updatedAt: updated.updated_at,
        changedFields: changedFields.length > 0 ? changedFields : [],
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
