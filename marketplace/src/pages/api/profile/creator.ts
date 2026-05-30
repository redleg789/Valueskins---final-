import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

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

    if (req.method === 'GET') {
      const result = await query(
        `SELECT
          u.display_name, u.username, u.bio, u.location, u.country, u.followers_count,
          u.main_platform, u.instagram_handle, u.tiktok_handle, u.youtube_handle,
          u.pitch_video_url, u.pitch_text, u.niche, u.engagement_rate,
          u.twitter_handle, u.linkedin_handle, u.website_url,
          u.open_for_work, u.min_deal_value, u.response_time_hours,
          COALESCE(r.trust_score, 0) as trust_score,
          COALESCE(r.completion_rate, 0) as completion_rate,
          COALESCE(r.repeat_client_rate, 0) as repeat_client_rate,
          COALESCE(r.avg_rating, 0) as avg_rating,
          u.verified
         FROM users u
         LEFT JOIN user_reputation r ON u.id = r.user_id
         WHERE u.id = $1`,
        [userId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      const row = result.rows[0];
      return res.json({
        display_name: row.display_name || '',
        username: row.username || '',
        bio: row.bio || '',
        location: row.location || '',
        country: row.country || '',
        languages: [],
        niche: row.niche || '',
        instagram: row.instagram_handle || '',
        tiktok: row.tiktok_handle || '',
        youtube: row.youtube_handle || '',
        twitter: row.twitter_handle || '',
        linkedin: row.linkedin_handle || '',
        website: row.website_url || '',
        followers_count: row.followers_count || 0,
        engagement_rate: row.engagement_rate || 0,
        pitch_video_url: row.pitch_video_url || '',
        pitch_text: row.pitch_text || '',
        portfolio_items: [],
        open_for_work: row.open_for_work ?? true,
        min_deal_value: row.min_deal_value || 500,
        preferred_deal_types: ['paid'],
        availability: 'available',
        response_time: row.response_time_hours || '24',
        trust_score: row.trust_score || 0,
        completion_rate: row.completion_rate || 0,
        repeat_client_rate: row.repeat_client_rate || 0,
        avg_rating: row.avg_rating || 0,
        verified: row.verified || false,
      });
    }

    if (req.method === 'PUT') {
      const {
        display_name,
        username,
        bio,
        location,
        country,
        niche,
        instagram,
        tiktok,
        youtube,
        twitter,
        linkedin,
        website,
        followers_count,
        engagement_rate,
        pitch_video_url,
        pitch_text,
        open_for_work,
        min_deal_value,
        response_time,
      } = req.body;

      await query(
        `UPDATE users
         SET display_name = $1, username = $2, bio = $3, location = $4, country = $5,
             niche = $6, instagram_handle = $7, tiktok_handle = $8, youtube_handle = $9,
             twitter_handle = $10, linkedin_handle = $11, website_url = $12,
             followers_count = $13, engagement_rate = $14, pitch_video_url = $15,
             pitch_text = $16, open_for_work = $17, min_deal_value = $18,
             response_time_hours = $19, updated_at = NOW()
         WHERE id = $20`,
        [
          display_name || '',
          username || '',
          bio || '',
          location || '',
          country || '',
          niche || '',
          instagram || '',
          tiktok || '',
          youtube || '',
          twitter || '',
          linkedin || '',
          website || '',
          followers_count || 0,
          engagement_rate || 0,
          pitch_video_url || '',
          pitch_text || '',
          open_for_work ?? true,
          min_deal_value || 500,
          response_time || '24',
          userId,
        ]
      );

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Creator profile API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
