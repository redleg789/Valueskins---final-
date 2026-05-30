import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionToken = req.cookies.valueskins_session;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user from session
    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = true AND expires_at > NOW()',
      [sessionToken]
    );

    if (!sessionResult.rows.length) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const userId = sessionResult.rows[0].user_id;

    if (req.method === 'GET') {
      const result = await query(
        `SELECT
          u.display_name, u.bio, u.location, u.country, u.followers_count,
          u.main_platform, u.instagram_handle, u.tiktok_handle, u.youtube_handle
         FROM users u
         WHERE u.id = $1`,
        [userId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const { display_name, bio, location, country, followers_count, main_platform, instagram_handle, tiktok_handle, youtube_handle } = req.body;

      // Validate
      if (!display_name || display_name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }

      if (!location || !country) {
        return res.status(400).json({ error: 'Location and country are required' });
      }

      if (!followers_count || followers_count < 0) {
        return res.status(400).json({ error: 'Followers count must be a positive number' });
      }

      if (!instagram_handle && !tiktok_handle && !youtube_handle) {
        return res.status(400).json({ error: 'At least one social media handle is required' });
      }

      await query(
        `UPDATE users
         SET display_name = $1, bio = $2, location = $3, country = $4,
             followers_count = $5, main_platform = $6,
             instagram_handle = $7, tiktok_handle = $8, youtube_handle = $9
         WHERE id = $10`,
        [display_name, bio || '', location, country, followers_count || 0, main_platform || 'instagram', instagram_handle || '', tiktok_handle || '', youtube_handle || '', userId]
      );

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Profile API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
