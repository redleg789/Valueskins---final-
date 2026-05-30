import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { getSessionUserId, getAccountId } from '@/lib/session';

const ok = (r: NextApiResponse, d: any) => r.status(200).json(d);
const created = (r: NextApiResponse, d: any) => r.status(201).json(d);
const bad = (r: NextApiResponse, m: string) => r.status(400).json({ error: m });
const notFound = (r: NextApiResponse) => r.status(404).json({ error: 'Not found' });
const unauthorized = (r: NextApiResponse) => r.status(401).json({ error: 'Unauthorized' });
const serverError = (r: NextApiResponse, m: string) => r.status(500).json({ error: m });

let dealReviewSchemaReady = false;

async function ensureDealReviewSchema() {
  if (dealReviewSchemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS deal_reviews (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      reviewee_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      reviewer_type VARCHAR(20) NOT NULL,
      rating_quality INTEGER CHECK (rating_quality >= 1 AND rating_quality <= 5),
      rating_communication INTEGER CHECK (rating_communication >= 1 AND rating_communication <= 5),
      rating_professionalism INTEGER CHECK (rating_professionalism >= 1 AND rating_professionalism <= 5),
      overall_rating DECIMAL(3, 2) GENERATED ALWAYS AS (
        (rating_quality + rating_communication + rating_professionalism) / 3.0
      ) STORED,
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(deal_id, reviewer_id)
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_deal_reviews_deal ON deal_reviews(deal_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_deal_reviews_reviewer ON deal_reviews(reviewer_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_deal_reviews_reviewee ON deal_reviews(reviewee_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_deal_reviews_overall ON deal_reviews(overall_rating DESC)');

  dealReviewSchemaReady = true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path || '';
  const cookie = req.headers.cookie || '';
  const sessionUser = await getSessionUserId(cookie);
  const accountId = await getAccountId(cookie);

  if (!sessionUser || !accountId) return unauthorized(res);

  const parts = pathStr.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];
  const action = parts[2];

  try {
    await ensureDealReviewSchema();

    switch (resource) {
      // ── DEAL REVIEWS ──
      case 'reviews': {
        // GET: Fetch reviews for a specific deal
        if (req.method === 'GET' && id) {
          const dealId = parseInt(id);
          if (isNaN(dealId)) return bad(res, 'Invalid deal ID');

          try {
            const result = await query(
              `SELECT
                dr.id, dr.deal_id, dr.reviewer_id, dr.reviewee_id,
                dr.reviewer_type, dr.rating_quality, dr.rating_communication,
                dr.rating_professionalism, dr.overall_rating, dr.comment,
                dr.created_at,
                a_reviewer.display_name as reviewer_name,
                a_reviewer.avatar_url as reviewer_avatar
              FROM deal_reviews dr
              JOIN accounts a_reviewer ON dr.reviewer_id = a_reviewer.id
              WHERE dr.deal_id = $1
              ORDER BY dr.created_at DESC`,
              [dealId]
            );

            return ok(res, {
              reviews: result.rows.map((row: any) => ({
                id: row.id,
                dealId: row.deal_id,
                reviewerId: row.reviewer_id,
                revieweeId: row.reviewee_id,
                reviewerType: row.reviewer_type,
                reviewerName: row.reviewer_name,
                reviewerAvatar: row.reviewer_avatar,
                ratings: {
                  quality: row.rating_quality,
                  communication: row.rating_communication,
                  professionalism: row.rating_professionalism,
                  overall: parseFloat(row.overall_rating),
                },
                comment: row.comment,
                createdAt: row.created_at,
              })),
            });
          } catch (err: any) {
            return serverError(res, 'Failed to fetch reviews');
          }
        }

        // POST: Submit a review for a deal
        if (req.method === 'POST' && id === 'submit') {
          const { dealId, revieweeId, reviewerType, ratings, comment } = req.body || {};

          if (!dealId || !revieweeId || !reviewerType || !ratings) {
            return bad(res, 'dealId, revieweeId, reviewerType, and ratings are required');
          }

          if (!ratings.quality || !ratings.communication || !ratings.professionalism) {
            return bad(res, 'All rating dimensions (quality, communication, professionalism) are required');
          }

          // Validate ratings are 1-5
          if (
            ratings.quality < 1 || ratings.quality > 5 ||
            ratings.communication < 1 || ratings.communication > 5 ||
            ratings.professionalism < 1 || ratings.professionalism > 5
          ) {
            return bad(res, 'Ratings must be between 1 and 5');
          }

          const revieweeIdNum = parseInt(revieweeId);
          if (isNaN(revieweeIdNum) || revieweeIdNum === accountId) {
            return bad(res, 'Cannot review yourself');
          }

          const dealIdNum = parseInt(dealId);
          if (isNaN(dealIdNum)) return bad(res, 'Invalid deal ID');

          try {
            // Verify deal exists and is completed
            const dealCheck = await query(
              `SELECT id FROM deals WHERE id = $1 AND status = 'completed' LIMIT 1`,
              [dealIdNum]
            );

            if (dealCheck.rows.length === 0) {
              return bad(res, 'Deal not found or not completed');
            }

            // Verify user is part of the deal
            const participantCheck = await query(
              `SELECT id FROM deal_participants
               WHERE deal_id = $1 AND account_id = $2 LIMIT 1`,
              [dealIdNum, accountId]
            );

            if (participantCheck.rows.length === 0) {
              return bad(res, 'You are not part of this deal');
            }

            // Verify reviewee is also part of the deal
            const revieweeCheck = await query(
              `SELECT id FROM deal_participants
               WHERE deal_id = $1 AND account_id = $2 LIMIT 1`,
              [dealIdNum, revieweeIdNum]
            );

            if (revieweeCheck.rows.length === 0) {
              return bad(res, 'Reviewee is not part of this deal');
            }

            // Submit or update review (upsert)
            const result = await query(
              `INSERT INTO deal_reviews (
                deal_id, reviewer_id, reviewee_id, reviewer_type,
                rating_quality, rating_communication, rating_professionalism, comment
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (deal_id, reviewer_id) DO UPDATE SET
                rating_quality = $5,
                rating_communication = $6,
                rating_professionalism = $7,
                comment = $8,
                updated_at = NOW()
              RETURNING id, overall_rating, created_at`,
              [
                dealIdNum,
                accountId,
                revieweeIdNum,
                reviewerType,
                ratings.quality,
                ratings.communication,
                ratings.professionalism,
                comment || null,
              ]
            );

            // Update reviewee's reputation metrics
            await query(
              `UPDATE user_reputation SET
                total_reviews = (
                  SELECT COUNT(*) FROM deal_reviews WHERE reviewee_id = $1
                ),
                avg_quality_rating = (
                  SELECT AVG(rating_quality) FROM deal_reviews WHERE reviewee_id = $1
                ),
                avg_communication_rating = (
                  SELECT AVG(rating_communication) FROM deal_reviews WHERE reviewee_id = $1
                ),
                avg_professionalism_rating = (
                  SELECT AVG(rating_professionalism) FROM deal_reviews WHERE reviewee_id = $1
                ),
                avg_overall_rating = (
                  SELECT AVG(overall_rating) FROM deal_reviews WHERE reviewee_id = $1
                ),
                creator_rank_score = (
                  SELECT COUNT(*) FROM deal_reviews WHERE reviewee_id = $1
                ) * 10 +
                COALESCE((SELECT AVG(overall_rating) FROM deal_reviews WHERE reviewee_id = $1), 0) * 5
              WHERE account_id = $1`,
              [revieweeIdNum]
            );

            return created(res, {
              id: result.rows[0].id,
              dealId: dealIdNum,
              revieweeId: revieweeIdNum,
              ratings,
              overallRating: parseFloat(result.rows[0].overall_rating),
              comment,
              createdAt: result.rows[0].created_at,
            });
          } catch (err: any) {
            console.error('Review submission error:', err);
            return serverError(res, 'Failed to submit review');
          }
        }

        break;
      }

      // ── CREATOR RANKINGS BY REVIEWS ──
      case 'rankings': {
        if (req.method === 'GET' && action === 'creators') {
          const { limit = '50', offset = '0' } = req.query;
          const limitNum = Math.min(parseInt(String(limit)) || 50, 100);
          const offsetNum = Math.max(parseInt(String(offset)) || 0, 0);

          try {
            // Get creators ranked by review count and overall rating
            const result = await query(
              `SELECT
                ur.account_id,
                a.display_name,
                a.avatar_url,
                a.username,
                ur.total_reviews,
                ur.avg_overall_rating,
                ur.avg_quality_rating,
                ur.avg_communication_rating,
                ur.avg_professionalism_rating,
                ur.creator_rank_score,
                ur.deals_completed,
                ROW_NUMBER() OVER (ORDER BY ur.creator_rank_score DESC) as rank
              FROM user_reputation ur
              JOIN accounts a ON ur.account_id = a.id
              WHERE ur.total_reviews > 0
              ORDER BY ur.creator_rank_score DESC
              LIMIT $1 OFFSET $2`,
              [limitNum, offsetNum]
            );

            const totalResult = await query(
              `SELECT COUNT(*) as total FROM user_reputation WHERE total_reviews > 0`
            );

            return ok(res, {
              rankings: result.rows.map((row: any) => ({
                rank: row.rank,
                creatorId: row.account_id,
                name: row.display_name,
                avatar: row.avatar_url,
                username: row.username,
                reviewCount: row.total_reviews,
                dealsCompleted: row.deals_completed,
                ratings: {
                  overall: parseFloat(row.avg_overall_rating || 0),
                  quality: parseFloat(row.avg_quality_rating || 0),
                  communication: parseFloat(row.avg_communication_rating || 0),
                  professionalism: parseFloat(row.avg_professionalism_rating || 0),
                },
                rankScore: parseFloat(row.creator_rank_score || 0),
              })),
              total: parseInt(totalResult.rows[0].total),
              limit: limitNum,
              offset: offsetNum,
            });
          } catch (err: any) {
            return serverError(res, 'Failed to fetch rankings');
          }
        }

        break;
      }

      // ── USER REVIEW HISTORY ──
      case 'user': {
        if (req.method === 'GET' && id && action === 'reviews') {
          const userId = parseInt(id);
          if (isNaN(userId)) return bad(res, 'Invalid user ID');

          const { role = 'received', limit = '20' } = req.query;
          const limitNum = Math.min(parseInt(String(limit)) || 20, 100);

          try {
            let query_text = '';
            let params: any[] = [];

            if (role === 'received') {
              // Reviews received by this user
              query_text = `
                SELECT
                  dr.id, dr.deal_id, dr.reviewer_id, dr.reviewer_type,
                  dr.rating_quality, dr.rating_communication, dr.rating_professionalism,
                  dr.overall_rating, dr.comment, dr.created_at,
                  a_reviewer.display_name as reviewer_name,
                  a_reviewer.avatar_url as reviewer_avatar
                FROM deal_reviews dr
                JOIN accounts a_reviewer ON dr.reviewer_id = a_reviewer.id
                WHERE dr.reviewee_id = $1
                ORDER BY dr.created_at DESC
                LIMIT $2
              `;
              params = [userId, limitNum];
            } else {
              // Reviews given by this user
              query_text = `
                SELECT
                  dr.id, dr.deal_id, dr.reviewee_id, dr.reviewer_type,
                  dr.rating_quality, dr.rating_communication, dr.rating_professionalism,
                  dr.overall_rating, dr.comment, dr.created_at,
                  a_reviewee.display_name as reviewee_name,
                  a_reviewee.avatar_url as reviewee_avatar
                FROM deal_reviews dr
                JOIN accounts a_reviewee ON dr.reviewee_id = a_reviewee.id
                WHERE dr.reviewer_id = $1
                ORDER BY dr.created_at DESC
                LIMIT $2
              `;
              params = [userId, limitNum];
            }

            const result = await query(query_text, params);

            return ok(res, {
              reviews: result.rows.map((row: any) => ({
                id: row.id,
                dealId: row.deal_id,
                otherPartyName: row.reviewer_name || row.reviewee_name,
                otherPartyAvatar: row.reviewer_avatar || row.reviewee_avatar,
                reviewerType: row.reviewer_type,
                ratings: {
                  quality: row.rating_quality,
                  communication: row.rating_communication,
                  professionalism: row.rating_professionalism,
                  overall: parseFloat(row.overall_rating),
                },
                comment: row.comment,
                createdAt: row.created_at,
              })),
            });
          } catch (err: any) {
            return serverError(res, 'Failed to fetch reviews');
          }
        }

        break;
      }

      default:
        return notFound(res);
    }
  } catch (error: any) {
    console.error('Deals API error:', error);
    return serverError(res, error.message || 'Internal server error');
  }
}
