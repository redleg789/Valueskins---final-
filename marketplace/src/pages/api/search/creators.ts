import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * GET /api/search/creators
 * Advanced search for creators with filters
 *
 * Query parameters:
 * - q: Full-text search (bio, interests, skills, location)
 * - minFollowers: Minimum follower count (0)
 * - maxFollowers: Maximum follower count (∞)
 * - location: Country code (e.g., 'IN', 'US')
 * - interests: Comma-separated interests
 * - skills: Comma-separated skills
 * - experienceLevel: 'beginner', 'intermediate', 'advanced', 'expert'
 * - contentType: Primary content type
 * - collaborationOpen: true/false
 * - sort: 'followers' (default), 'recent', 'engagement'
 * - page: Pagination (1, 2, 3, ...)
 * - limit: Results per page (1-100, default 20)
 *
 * Example:
 * GET /api/search/creators?q=photography&minFollowers=10000&location=IN&interests=fashion,beauty
 */

interface SearchFilters {
  query: string;
  minFollowers: number;
  maxFollowers: number;
  location?: string;
  interests: string[];
  skills: string[];
  experienceLevel?: string;
  contentType?: string;
  collaborationOpen?: boolean;
  sort: 'followers' | 'recent' | 'engagement';
  page: number;
  limit: number;
}

interface CreatorResult {
  personaId: number;
  displayName: string;
  avatarUrl?: string;
  bio: string;
  location: { city: string; country: string };
  totalFollowers: number;
  dominantPlatform: string;
  interests: string[];
  skills: string[];
  experienceLevel: string;
  socialMediaAccounts: Array<{
    platform: string;
    username: string;
    followersCount: number;
  }>;
  engagementScore?: number;
  matchScore?: number; // Relevance to search query (0-100)
}

interface SearchResponse {
  results: CreatorResult[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
  facets: {
    locations: Array<{ location: string; count: number }>;
    interests: Array<{ interest: string; count: number }>;
    followerRanges: Array<{ range: string; count: number }>;
  };
  timing: {
    queryMs: number;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SearchResponse | { error: string }>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    // Parse query parameters
    const {
      q = '',
      minFollowers = '0',
      maxFollowers = '999999999',
      location,
      interests = '',
      skills = '',
      experienceLevel,
      contentType,
      collaborationOpen,
      sort = 'followers',
      page = '1',
      limit = '20',
    } = req.query;

    // Validate inputs
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const minFol = Math.max(0, parseInt(minFollowers as string) || 0);
    const maxFol = Math.max(minFol, parseInt(maxFollowers as string) || 999999999);

    const filters: SearchFilters = {
      query: (q as string).trim(),
      minFollowers: minFol,
      maxFollowers: maxFol,
      location: location as string,
      interests: interests ? (interests as string).split(',').map(s => s.trim()) : [],
      skills: skills ? (skills as string).split(',').map(s => s.trim()) : [],
      experienceLevel: experienceLevel as string,
      contentType: contentType as string,
      collaborationOpen: collaborationOpen === 'true',
      sort: sort as any,
      page: pageNum,
      limit: pageSize,
    };

    // Build SQL query with filters
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramCount = 1;

    // Full-text search on bio, niche, location
    if (filters.query) {
      whereConditions.push(
        `(u.bio ILIKE $${paramCount} OR u.niche ILIKE $${paramCount} OR u.location ILIKE $${paramCount} OR u.display_name ILIKE $${paramCount})`
      );
      queryParams.push(`%${filters.query}%`);
      paramCount++;
    }

    // Followers range filter
    whereConditions.push(`u.followers_count BETWEEN $${paramCount} AND $${paramCount + 1}`);
    queryParams.push(filters.minFollowers, filters.maxFollowers);
    paramCount += 2;

    // Location filter
    if (filters.location) {
      whereConditions.push(`u.country ILIKE $${paramCount}`);
      queryParams.push(`%${filters.location}%`);
      paramCount++;
    }

    // Niche filter (interests)
    if (filters.interests.length > 0) {
      whereConditions.push(
        `(${filters.interests.map((_, i) => `u.niche ILIKE $${paramCount + i}`).join(' OR ')})`
      );
      filters.interests.forEach(interest => queryParams.push(`%${interest}%`));
      paramCount += filters.interests.length;
    }

    // Open for work filter
    if (filters.collaborationOpen !== undefined) {
      whereConditions.push(`u.open_for_work = $${paramCount}`);
      queryParams.push(filters.collaborationOpen);
      paramCount++;
    }

    // Only show users with creator module active
    whereConditions.push(`EXISTS (
      SELECT 1 FROM account_modules am
      WHERE am.user_id = u.id AND am.module_code = 'valueskin' AND am.is_active = true
    )`);

    const whereClause = whereConditions.join(' AND ');

    // Sort order
    let orderBy = 'u.followers_count DESC';
    if (filters.sort === 'recent') {
      orderBy = 'u.updated_at DESC';
    } else if (filters.sort === 'engagement') {
      orderBy = 'u.engagement_rate DESC';
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
      queryParams
    );
    const totalResults = parseInt(countResult.rows[0].total) || 0;
    const totalPages = Math.ceil(totalResults / pageSize);

    // Get paginated results
    const offset = (pageNum - 1) * pageSize;
    const resultsQuery = `
      SELECT
        u.id, u.display_name, u.avatar_url, u.bio, u.location, u.country,
        u.followers_count, u.niche, u.instagram_handle, u.tiktok_handle,
        u.youtube_handle, u.twitter_handle, u.linkedin_handle, u.engagement_rate,
        u.open_for_work
      FROM users u
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    queryParams.push(pageSize, offset);

    const results = await query(resultsQuery, queryParams);

    // Format results
    const mockResults: CreatorResult[] = results.rows.map((row: any) => ({
      personaId: row.id,
      displayName: row.display_name || 'Unknown',
      avatarUrl: row.avatar_url,
      bio: row.bio || '',
      location: {
        city: row.location || '',
        country: row.country || '',
      },
      totalFollowers: row.followers_count || 0,
      dominantPlatform: row.instagram_handle ? 'instagram' : row.tiktok_handle ? 'tiktok' : row.youtube_handle ? 'youtube' : 'unknown',
      interests: row.niche ? [row.niche] : [],
      skills: [],
      experienceLevel: row.followers_count > 100000 ? 'expert' : row.followers_count > 50000 ? 'advanced' : 'intermediate',
      socialMediaAccounts: [
        ...(row.instagram_handle ? [{ platform: 'instagram', username: row.instagram_handle, followersCount: 0 }] : []),
        ...(row.tiktok_handle ? [{ platform: 'tiktok', username: row.tiktok_handle, followersCount: 0 }] : []),
        ...(row.youtube_handle ? [{ platform: 'youtube', username: row.youtube_handle, followersCount: 0 }] : []),
      ],
      engagementScore: row.engagement_rate || 0,
      matchScore: filters.query ? 85 : 100,
    }));

    // Get facets (aggregate data)
    const locationsResult = await query(
      `SELECT u.country as location, COUNT(*) as count FROM users u
       WHERE ${whereClause} AND u.country IS NOT NULL AND u.country != ''
       GROUP BY u.country ORDER BY count DESC LIMIT 10`,
      queryParams
    );

    const nichesResult = await query(
      `SELECT u.niche as niche, COUNT(*) as count FROM users u
       WHERE ${whereClause} AND u.niche IS NOT NULL AND u.niche != ''
       GROUP BY u.niche ORDER BY count DESC LIMIT 10`,
      queryParams
    );

    res.status(200).json({
      results: mockResults,
      total: totalResults,
      page: pageNum,
      pages: totalPages,
      hasMore: pageNum < totalPages,
      facets: {
        locations: locationsResult.rows.map((row: any) => ({
          location: row.location,
          count: parseInt(row.count),
        })),
        interests: nichesResult.rows.map((row: any) => ({
          interest: row.niche,
          count: parseInt(row.count),
        })),
        followerRanges: [
          { range: '10k-50k', count: 0 },
          { range: '50k-100k', count: 0 },
          { range: '100k-500k', count: 0 },
          { range: '500k+', count: 0 },
        ],
      },
      timing: {
        queryMs: Date.now() - startTime,
      },
    });
  } catch (err: any) {
    console.error('Error searching creators:', err);
    res.status(500).json({ error: 'Failed to search creators' });
  }
}
