import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { getSessionUserId, getAccountId } from '@/lib/session';

const ok = (r: NextApiResponse, d: any) => r.status(200).json(d);
const created = (r: NextApiResponse, d: any) => r.status(201).json(d);
const bad = (r: NextApiResponse, m: string) => r.status(400).json({ error: m });
const notFound = (r: NextApiResponse) => r.status(404).json({ error: 'Not found' });
const unauthorized = (r: NextApiResponse) => r.status(401).json({ error: 'Unauthorized' });
const serverError = (r: NextApiResponse, m: string) => r.status(500).json({ error: m });

let locationSchemaReady = false;

async function ensureLocationSchema() {
  if (locationSchemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS user_locations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100),
      country VARCHAR(100) NOT NULL,
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, city, country)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_user_locations_city_country ON user_locations(city, country)');
  await query('CREATE INDEX IF NOT EXISTS idx_user_locations_coords ON user_locations(latitude, longitude)');

  locationSchemaReady = true;
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

  try {
    await ensureLocationSchema();

    switch (resource) {
      // ── USER LOCATIONS ──
      case 'locations': {
        if (req.method === 'GET') {
          try {
            const result = await query(
              `SELECT id, city, state, country, latitude, longitude, is_primary
               FROM user_locations
               WHERE user_id = $1
               ORDER BY is_primary DESC, created_at ASC`,
              [accountId]
            );

            return ok(res, {
              locations: result.rows.map((row: any) => ({
                id: row.id,
                city: row.city,
                state: row.state,
                country: row.country,
                latitude: row.latitude ? parseFloat(row.latitude) : undefined,
                longitude: row.longitude ? parseFloat(row.longitude) : undefined,
                isPrimary: row.is_primary,
              })),
            });
          } catch (err: any) {
            return serverError(res, 'Failed to fetch locations');
          }
        }

        if (req.method === 'POST') {
          const { city, state, country, latitude, longitude, isPrimary = false } = req.body || {};

          if (!city || !country) {
            return bad(res, 'City and country are required');
          }

          try {
            const result = await query(
              `INSERT INTO user_locations (user_id, city, state, country, latitude, longitude, is_primary)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (user_id, city, country) DO UPDATE
               SET state = $3, latitude = $5, longitude = $6, updated_at = NOW()
               RETURNING id, city, state, country, latitude, longitude, is_primary`,
              [
                accountId,
                city,
                state || null,
                country,
                latitude || null,
                longitude || null,
                isPrimary,
              ]
            );

            if (isPrimary) {
              await query(
                `UPDATE user_locations SET is_primary = FALSE WHERE user_id = $1 AND id != $2`,
                [accountId, result.rows[0].id]
              );
            }

            return created(res, {
              id: result.rows[0].id,
              city: result.rows[0].city,
              state: result.rows[0].state,
              country: result.rows[0].country,
              latitude: result.rows[0].latitude ? parseFloat(result.rows[0].latitude) : undefined,
              longitude: result.rows[0].longitude ? parseFloat(result.rows[0].longitude) : undefined,
              isPrimary: result.rows[0].is_primary,
            });
          } catch (err: any) {
            console.error('Location creation error:', err);
            return serverError(res, 'Failed to create location');
          }
        }

        break;
      }

      // ── SPECIFIC LOCATION ──
      case 'locations': {
        const locationId = parseInt(id);
        if (Number.isNaN(locationId)) return bad(res, 'Invalid location ID');

        if (req.method === 'PATCH') {
          const { city, state, country, latitude, longitude, isPrimary } = req.body || {};

          try {
            // Verify ownership
            const ownership = await query(
              `SELECT user_id FROM user_locations WHERE id = $1`,
              [locationId]
            );

            if (ownership.rows.length === 0 || ownership.rows[0].user_id !== accountId) {
              return unauthorized(res);
            }

            const result = await query(
              `UPDATE user_locations
               SET city = COALESCE($2, city),
                   state = COALESCE($3, state),
                   country = COALESCE($4, country),
                   latitude = COALESCE($5, latitude),
                   longitude = COALESCE($6, longitude),
                   is_primary = COALESCE($7, is_primary),
                   updated_at = NOW()
               WHERE id = $1 AND user_id = $8
               RETURNING id, city, state, country, latitude, longitude, is_primary`,
              [locationId, city, state, country, latitude, longitude, isPrimary, accountId]
            );

            if (result.rows.length === 0) return notFound(res);

            if (isPrimary) {
              await query(
                `UPDATE user_locations SET is_primary = FALSE WHERE user_id = $1 AND id != $2`,
                [accountId, locationId]
              );
            }

            return ok(res, {
              id: result.rows[0].id,
              city: result.rows[0].city,
              state: result.rows[0].state,
              country: result.rows[0].country,
              latitude: result.rows[0].latitude ? parseFloat(result.rows[0].latitude) : undefined,
              longitude: result.rows[0].longitude ? parseFloat(result.rows[0].longitude) : undefined,
              isPrimary: result.rows[0].is_primary,
            });
          } catch (err: any) {
            return serverError(res, 'Failed to update location');
          }
        }

        if (req.method === 'DELETE') {
          try {
            const result = await query(
              `DELETE FROM user_locations WHERE id = $1 AND user_id = $2`,
              [locationId, accountId]
            );

            if (result.rowCount === 0) return notFound(res);
            return ok(res, { deleted: true });
          } catch (err: any) {
            return serverError(res, 'Failed to delete location');
          }
        }

        break;
      }

      default:
        return notFound(res);
    }
  } catch (error: any) {
    console.error('Settings API error:', error);
    return serverError(res, error.message || 'Internal server error');
  }
}
