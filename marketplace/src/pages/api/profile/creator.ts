import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sessionToken = req.cookies.valueskins_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const userId = sessionResult.rows[0].user_id;

    if (req.method === 'GET') {
      const profileResult = await query(
        `SELECT
          display_name, username, bio, location, country,
          instagram_handle, tiktok_handle, youtube_handle, twitter_handle, linkedin_handle,
          website, followers_count, engagement_rate, niche,
          languages, open_for_work, min_deal_value, preferred_deal_types,
          availability, response_time, pitch_video_url, pitch_text,
          portfolio_items
        FROM users WHERE id = $1`,
        [userId]
      );

      if (profileResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(200).json(profileResult.rows[0]);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const {
        display_name, username, bio, location, country,
        instagram_handle, tiktok_handle, youtube_handle, twitter_handle, linkedin_handle,
        website, niche, languages, open_for_work, min_deal_value, preferred_deal_types,
        availability, response_time, pitch_video_url, pitch_text
      } = req.body;

      // Build UPDATE query dynamically to handle optional fields
      const updates = [];
      const params = [];
      let paramCount = 1;

      const fields = {
        display_name, username, bio, location, country,
        instagram_handle, tiktok_handle, youtube_handle, twitter_handle, linkedin_handle,
        website, niche, languages, open_for_work, min_deal_value, preferred_deal_types,
        availability, response_time, pitch_video_url, pitch_text
      };

      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) {
          updates.push(`${key} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
      }

      updates.push(`updated_at = NOW()`);
      params.push(userId);

      if (updates.length === 1) {
        // Only updated_at changed
        updates.pop(); // remove the NOW() addition
        await query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [userId]);
      } else {
        await query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
          params
        );
      }

      return res.status(200).json({ message: 'Profile updated', userId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Creator profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
