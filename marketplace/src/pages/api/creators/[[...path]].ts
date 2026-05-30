import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

const ok = (r: NextApiResponse, d: any) => r.status(200).json(d);
const notFound = (r: NextApiResponse) => r.status(404).json({ error: 'Not found' });
const bad = (r: NextApiResponse, m: string) => r.status(400).json({ error: m });
const serverError = (r: NextApiResponse, m: string) => r.status(500).json({ error: m });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path || '';
  const parts = pathStr.split('/').filter(Boolean);
  const resource = parts[0];
  const identifier = parts[1];

  try {
    switch (resource) {
      // ── CREATOR PROFILE ──
      case 'profile': {
        if (req.method === 'GET' && identifier) {
          // Search by username
          const username = identifier;

          try {
            // Get creator by username
            const creatorResult = await query(
              `SELECT
                a.id, a.username, a.display_name as real_name, a.bio, a.avatar_url,
                u.valueskins_id, u.location,
                us.valueskin_code,
                ur.total_reviews, ur.avg_overall_rating, ur.avg_quality_rating,
                ur.avg_communication_rating, ur.avg_professionalism_rating,
                ur.creator_rank_score, ur.deals_completed
              FROM accounts a
              LEFT JOIN users u ON a.id = u.account_id
              LEFT JOIN user_stickers us ON u.id = us.user_id AND us.is_active = TRUE
              LEFT JOIN user_reputation ur ON a.id = ur.account_id
              WHERE a.username = $1 AND us.id IS NOT NULL
              LIMIT 1`,
              [username]
            );

            if (creatorResult.rows.length === 0) {
              return notFound(res);
            }

            const creator = creatorResult.rows[0];

            // Get creator's rank position
            const rankResult = await query(
              `SELECT COUNT(*) as rank_position
              FROM user_reputation
              WHERE creator_rank_score > (
                SELECT creator_rank_score FROM user_reputation WHERE account_id = $1
              )`,
              [creator.id]
            );

            const rankPosition = parseInt(rankResult.rows[0]?.rank_position || '0') + 1;

            return ok(res, {
              creator: {
                id: creator.id,
                realName: creator.real_name,
                username: creator.username,
                valueSkinsId: creator.valueskin_code,
                avatar: creator.avatar_url,
                bio: creator.bio,
                location: creator.location,
                totalReviews: creator.total_reviews || 0,
                avgOverallRating: parseFloat(creator.avg_overall_rating) || 0,
                avgQualityRating: parseFloat(creator.avg_quality_rating) || 0,
                avgCommunicationRating: parseFloat(creator.avg_communication_rating) || 0,
                avgProfessionalismRating: parseFloat(creator.avg_professionalism_rating) || 0,
                dealsCompleted: creator.deals_completed || 0,
                rankScore: parseFloat(creator.creator_rank_score) || 0,
                rankPosition: rankPosition,
              },
            });
          } catch (err: any) {
            return serverError(res, 'Failed to fetch creator profile');
          }
        }

        // Search by real name
        if (req.method === 'GET' && !identifier) {
          const { q } = req.query;
          if (!q) return bad(res, 'Search query required');

          try {
            const searchResults = await query(
              `SELECT
                a.id, a.username, a.display_name as real_name, a.avatar_url,
                ur.total_reviews, ur.avg_overall_rating
              FROM accounts a
              LEFT JOIN users u ON a.id = u.account_id
              LEFT JOIN user_reputation ur ON a.id = ur.account_id
              WHERE (a.display_name ILIKE $1 OR a.username ILIKE $1)
                AND u.valueskins_id IS NOT NULL
              ORDER BY ur.creator_rank_score DESC
              LIMIT 20`,
              [`%${q}%`]
            );

            return ok(res, {
              results: searchResults.rows.map((row: any) => ({
                id: row.id,
                realName: row.real_name,
                username: row.username,
                avatar: row.avatar_url,
                reviews: row.total_reviews || 0,
                rating: parseFloat(row.avg_overall_rating) || 0,
              })),
            });
          } catch (err: any) {
            return serverError(res, 'Search failed');
          }
        }

        break;
      }

      // ── CREATOR WORK HISTORY ──
      case 'work': {
        if (req.method === 'GET' && identifier) {
          const creatorId = parseInt(identifier);
          if (isNaN(creatorId)) return bad(res, 'Invalid creator ID');

          try {
            // Get content deals
            const contentDeals = await query(
              `SELECT
                d.id, d.title, d.status, d.completed_at,
                CASE WHEN dr.rating_quality IS NOT NULL
                  THEN (dr.rating_quality + dr.rating_communication + dr.rating_professionalism) / 3.0
                  ELSE NULL
                END as rating,
                COALESCE(a.display_name, 'Brand') as partner_name
              FROM deals d
              LEFT JOIN deal_reviews dr ON d.id = dr.deal_id AND dr.reviewer_id != d.creator_id
              LEFT JOIN accounts a ON d.brand_id = a.id
              WHERE d.creator_id = $1
              ORDER BY d.completed_at DESC`,
              [creatorId]
            );

            // Get events hosted OR tagged (marketplace integration)
            let events = { rows: [] };
            try {
              events = await query(
                `SELECT DISTINCT
                  e.id, e.title, e.status, e.event_date as completed_at,
                  CASE WHEN e.host_id = $1 THEN 'host' ELSE 'performer' END as role,
                  a.display_name as host_name
                FROM events e
                LEFT JOIN accounts a ON e.host_id = a.id
                WHERE e.host_id = $1
                  OR e.tagged_creators @> $2::jsonb
                ORDER BY e.event_date DESC`,
                [creatorId, JSON.stringify([{ creatorId }])]
              );
            } catch (eventErr) {
              // Events table may not exist, just continue with empty events
              events = { rows: [] };
            }

            const workItems = [
              ...contentDeals.rows.map((row: any) => ({
                id: row.id,
                title: row.title,
                type: 'content',
                status: row.status || 'completed',
                completedAt: row.completed_at,
                rating: row.rating ? parseFloat(row.rating).toFixed(1) : undefined,
                partnerId: 0,
                partnerName: row.partner_name,
              })),
              ...events.rows.map((row: any) => ({
                id: row.id,
                title: row.title,
                type: 'event',
                status: row.status || 'completed',
                completedAt: row.completed_at,
                partnerId: 0,
                partnerName: row.host_name || '',
                role: row.role || 'performer',
              })),
            ];

            // If no work items, return 404 to indicate no data
            if (workItems.length === 0) {
              return res.status(404).json({ workItems: [] });
            }

            return ok(res, { workItems });
          } catch (err: any) {
            return serverError(res, 'Failed to fetch work history');
          }
        }

        break;
      }

      // ── CREATOR SEARCH ──
      case 'search': {
        if (req.method === 'GET') {
          const { q, type } = req.query;
          if (!q) return bad(res, 'Search query required');

          try {
            let query_text = '';
            let params: any[] = [];

            // Search by username, real name, or valueskins ID
            if (type === 'valueskins-id') {
              query_text = `
                SELECT
                  a.id, a.username, a.display_name as real_name, a.avatar_url,
                  u.valueskins_id,
                  ur.total_reviews, ur.avg_overall_rating, ur.creator_rank_score
                FROM accounts a
                JOIN users u ON a.id = u.account_id
                LEFT JOIN user_reputation ur ON a.id = ur.account_id
                WHERE u.valueskins_id = $1
                LIMIT 5
              `;
              params = [String(q).toUpperCase()];
            } else {
              query_text = `
                SELECT
                  a.id, a.username, a.display_name as real_name, a.avatar_url,
                  u.valueskins_id,
                  ur.total_reviews, ur.avg_overall_rating, ur.creator_rank_score
                FROM accounts a
                JOIN users u ON a.id = u.account_id
                LEFT JOIN user_reputation ur ON a.id = ur.account_id
                WHERE (a.display_name ILIKE $1 OR a.username ILIKE $1)
                  AND u.valueskins_id IS NOT NULL
                ORDER BY ur.creator_rank_score DESC
                LIMIT 10
              `;
              params = [`%${q}%`];
            }

            const results = await query(query_text, params);

            return ok(res, {
              results: results.rows.map((row: any) => ({
                id: row.id,
                realName: row.real_name,
                username: row.username,
                valueSkinsId: row.valueskins_id,
                avatar: row.avatar_url,
                reviews: row.total_reviews || 0,
                rating: parseFloat(row.avg_overall_rating) || 0,
                rankScore: parseFloat(row.creator_rank_score) || 0,
              })),
            });
          } catch (err: any) {
            return serverError(res, 'Search failed');
          }
        }

        break;
      }

      default:
        return notFound(res);
    }
  } catch (error: any) {
    console.error('Creators API error:', error);
    return serverError(res, error.message || 'Internal server error');
  }
}
