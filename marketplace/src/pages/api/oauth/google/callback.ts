import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeGoogleCode, getGoogleUserInfo } from '@/lib/oauth';
import { query } from '@/lib/db';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

interface GoogleUser {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${error}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).redirect('/?error=missing_code');
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.access_token) {
      return res.status(400).redirect('/?error=token_failed');
    }

    // Get user info
    const googleUser = (await getGoogleUserInfo(tokens.access_token)) as GoogleUser;
    if (!googleUser.email) {
      return res.status(400).redirect('/?error=no_email');
    }

    // Find or create user
    let userId: string;

    // Try by google_id first
    let result = await query('SELECT id FROM users WHERE google_id = $1', [googleUser.sub]);

    if (result.rows.length > 0) {
      userId = result.rows[0].id;
      // Update timestamp
      await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [userId]);
    } else {
      // Try by email
      result = await query('SELECT id FROM users WHERE email = $1 AND is_deleted = FALSE', [googleUser.email]);

      if (result.rows.length > 0) {
        userId = result.rows[0].id;
        // Link google_id
        await query('UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2', [googleUser.sub, userId]);
      } else {
        // Create new user
        const createResult = await query(
          'INSERT INTO users (email, display_name, avatar_url, google_id) VALUES ($1, $2, $3, $4) RETURNING id',
          [googleUser.email, googleUser.name || googleUser.email, googleUser.picture || null, googleUser.sub]
        );
        userId = createResult.rows[0].id;

        // Create account
        await query('INSERT INTO accounts (user_id) VALUES ($1)', [userId]);
      }
    }

    // Create session
    const sessionId = generateUUID();
    const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);

    await query(
      'INSERT INTO auth_sessions (id, user_id, is_active, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, userId, true, expiresAt]
    );

    // Set secure cookie
    res.setHeader('Set-Cookie', `valueskins_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`);

    // Redirect to home
    return res.redirect('/demo/instagram');
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).redirect('/?error=auth_failed');
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
