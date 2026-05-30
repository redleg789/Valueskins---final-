import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { getSessionUserId, getAccountId } from '@/lib/session';

const ok = (r: NextApiResponse, d: any) => r.status(200).json(d);
const bad = (r: NextApiResponse, m: string) => r.status(400).json({ error: m });
const notFound = (r: NextApiResponse) => r.status(404).json({ error: 'Not found' });
const unauthorized = (r: NextApiResponse) => r.status(401).json({ error: 'Unauthorized' });
const serverError = (r: NextApiResponse, m: string) => r.status(500).json({ error: m });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path || '';
  const cookie = req.headers.cookie || '';
  const sessionUser = await getSessionUserId(cookie);
  const accountId = await getAccountId(cookie);

  if (!sessionUser || !accountId) return unauthorized(res);

  const parts = pathStr.split('/').filter(Boolean);
  const resource = parts[0];
  const action = parts[1];

  try {
    switch (resource) {
      // ── VALUESKINS CREATORS SEARCH ──
      case 'creators': {
        if (req.method === 'GET' && action === 'search') {
          const {
            city,
            country,
            latitude,
            longitude,
            radiusKm = '50',
            minFollowers = '0',
            maxFollowers = '99999999',
            minLevel = '0',
            platforms,
            profession,
            verified,
            limit = '50',
          } = req.query;

          try {
            let whereClause = 'WHERE 1=1';
            const params: any[] = [];
            let paramCount = 1;

            // Location-based filtering
            if (latitude && longitude) {
              const lat = parseFloat(String(latitude));
              const lng = parseFloat(String(longitude));
              const radius = parseInt(String(radiusKm));

              if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
                // Haversine formula for distance calculation
                whereClause += `
                  AND (
                    6371 * acos(
                      cos(radians(${lat})) * cos(radians(la.latitude)) *
                      cos(radians(la.longitude) - radians(${lng})) +
                      sin(radians(${lat})) * sin(radians(la.latitude))
                    ) <= ${radius}
                  )
                `;
              }
            } else if (city || country) {
              // City/country-based filtering
              if (city) {
                whereClause += ` AND LOWER(la.city) = LOWER($${paramCount})`;
                params.push(String(city));
                paramCount++;
              }
              if (country) {
                whereClause += ` AND LOWER(la.country) = LOWER($${paramCount})`;
                params.push(String(country));
                paramCount++;
              }
            }

            // Followers filtering
            const minFoll = parseInt(String(minFollowers));
            const maxFoll = parseInt(String(maxFollowers));
            if (!isNaN(minFoll)) {
              whereClause += ` AND us.followers_count >= $${paramCount}`;
              params.push(minFoll);
              paramCount++;
            }
            if (!isNaN(maxFoll)) {
              whereClause += ` AND us.followers_count <= $${paramCount}`;
              params.push(maxFoll);
              paramCount++;
            }

            // Level filtering
            const minLvl = parseInt(String(minLevel));
            if (!isNaN(minLvl)) {
              whereClause += ` AND us.level >= $${paramCount}`;
              params.push(minLvl);
              paramCount++;
            }

            // Profession filtering
            if (profession) {
              whereClause += ` AND LOWER(us.profession) ILIKE $${paramCount}`;
              params.push(`%${String(profession)}%`);
              paramCount++;
            }

            // Verified filtering
            if (verified === 'true' || verified === '1') {
              whereClause += ` AND us.is_verified = true`;
            }

            // Platforms filtering
            if (platforms && String(platforms).length > 0) {
              const platArr = String(platforms).split(',');
              whereClause += ` AND us.platforms && $${paramCount}`;
              params.push(platArr);
              paramCount++;
            }

            const limitNum = Math.min(parseInt(String(limit)) || 50, 100);

            const result = await query(
              `SELECT DISTINCT
                us.id, us.username, us.display_name, us.avatar_url,
                us.is_verified, us.followers_count, us.level,
                us.profession, us.platforms,
                us.avg_rating, us.total_deals_completed,
                ARRAY_AGG(
                  JSON_BUILD_OBJECT(
                    'city', la.city,
                    'state', la.state,
                    'country', la.country,
                    'latitude', la.latitude,
                    'longitude', la.longitude
                  )
                ) FILTER (WHERE la.city IS NOT NULL) as locations
              FROM users us
              LEFT JOIN user_locations la ON us.id = la.user_id
              ${whereClause}
              GROUP BY us.id
              LIMIT $${paramCount}`,
              [...params, limitNum]
            );

            const creators = result.rows.map((row: any) => ({
              id: String(row.id),
              name: row.display_name || row.username,
              handle: row.username,
              avatar: row.avatar_url || '',
              verified: row.is_verified,
              followers: row.followers_count || 0,
              level: row.level || 1,
              profession: row.profession || '',
              platforms: row.platforms || [],
              avgRating: row.avg_rating || 0,
              totalDealsCompleted: row.total_deals_completed || 0,
              locations: row.locations || [],
            }));

            return ok(res, creators);
          } catch (err: any) {
            console.error('Creator search error:', err);
            return serverError(res, 'Failed to search creators');
          }
        }

        if (req.method === 'GET' && action === 'nearby') {
          const {
            latitude,
            longitude,
            radiusKm = '50',
            limit = '50',
          } = req.query;

          if (!latitude || !longitude) {
            return bad(res, 'latitude and longitude are required');
          }

          try {
            const lat = parseFloat(String(latitude));
            const lng = parseFloat(String(longitude));
            const radius = parseInt(String(radiusKm));
            const limitNum = Math.min(parseInt(String(limit)) || 50, 100);

            if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
              return bad(res, 'Invalid coordinates');
            }

            const result = await query(
              `SELECT
                us.id, us.username, us.display_name, us.avatar_url,
                us.is_verified, us.followers_count, us.level,
                us.profession, us.platforms,
                us.avg_rating, us.total_deals_completed,
                la.city, la.state, la.country, la.latitude, la.longitude,
                6371 * acos(
                  cos(radians($1)) * cos(radians(la.latitude)) *
                  cos(radians(la.longitude) - radians($2)) +
                  sin(radians($1)) * sin(radians(la.latitude))
                ) as distance
              FROM users us
              JOIN user_locations la ON us.id = la.user_id
              WHERE 6371 * acos(
                cos(radians($1)) * cos(radians(la.latitude)) *
                cos(radians(la.longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(la.latitude))
              ) <= $3
              ORDER BY distance ASC
              LIMIT $4`,
              [lat, lng, radius, limitNum]
            );

            const creators = result.rows.map((row: any) => ({
              id: String(row.id),
              name: row.display_name || row.username,
              handle: row.username,
              avatar: row.avatar_url || '',
              verified: row.is_verified,
              followers: row.followers_count || 0,
              level: row.level || 1,
              profession: row.profession || '',
              platforms: row.platforms || [],
              avgRating: row.avg_rating || 0,
              totalDealsCompleted: row.total_deals_completed || 0,
              primaryLocation: {
                city: row.city,
                state: row.state,
                country: row.country,
                latitude: row.latitude,
                longitude: row.longitude,
              },
              distance: row.distance,
            }));

            return ok(res, creators);
          } catch (err: any) {
            console.error('Nearby creators error:', err);
            return serverError(res, 'Failed to fetch nearby creators');
          }
        }

        break;
      }

      // ── VALUESKINS LOCATIONS ──
      case 'locations': {
        if (req.method === 'GET' && action === 'suggest') {
          const { query: searchQuery } = req.query;
          if (!searchQuery) return bad(res, 'query required');

          try {
            const result = await query(
              `SELECT DISTINCT city, state, country
               FROM user_locations
               WHERE LOWER(city) ILIKE $1 OR LOWER(state) ILIKE $1 OR LOWER(country) ILIKE $1
               ORDER BY city, country
               LIMIT 20`,
              [`%${String(searchQuery)}%`]
            );

            const locations = result.rows.map((row: any) => ({
              city: row.city,
              state: row.state,
              country: row.country,
              label: `${row.city}${row.state ? ', ' + row.state : ''}, ${row.country}`,
            }));

            return ok(res, locations);
          } catch (err: any) {
            return serverError(res, 'Failed to fetch location suggestions');
          }
        }

        if (req.method === 'GET' && action === 'popular') {
          const { limit = '10' } = req.query;

          try {
            const limitNum = Math.min(parseInt(String(limit)) || 10, 50);
            const result = await query(
              `SELECT city, state, country, COUNT(*) as creator_count
               FROM user_locations
               GROUP BY city, state, country
               ORDER BY creator_count DESC
               LIMIT $1`,
              [limitNum]
            );

            const locations = result.rows.map((row: any) => ({
              city: row.city,
              state: row.state,
              country: row.country,
              creatorCount: row.creator_count,
              label: `${row.city}${row.state ? ', ' + row.state : ''}, ${row.country}`,
            }));

            return ok(res, locations);
          } catch (err: any) {
            return serverError(res, 'Failed to fetch popular locations');
          }
        }

        break;
      }

      default:
        return notFound(res);
    }
  } catch (error: any) {
    console.error('Valueskins API error:', error);
    return serverError(res, error.message || 'Internal server error');
  }
}
