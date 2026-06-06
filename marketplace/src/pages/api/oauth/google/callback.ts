import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { exchangeGoogleCode, getGoogleUserInfo } from '@/lib/oauth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors from Google
  if (error) {
    console.error('Google OAuth error:', error, error_description);
    return res.redirect(`/?error=${error}&error_description=${error_description}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/?error=missing_code');
  }

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeGoogleCode(code);

    if (!tokens.access_token) {
      return res.redirect('/?error=no_access_token');
    }

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.access_token);

    if (!googleUser.email) {
      return res.redirect('/?error=no_email');
    }

    // Find or create user
    const existingUser = await query(
      'SELECT id, account_id FROM users WHERE instagram_user_id = $1',
      [googleUser.email]
    );

    let userId: number;
    let accountId: number;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      accountId = existingUser.rows[0].account_id;
    } else {
      // Create new account and user
      const accountResult = await query(
        `INSERT INTO accounts (display_name, email)
         VALUES ($1, $2)
         RETURNING id`,
        [googleUser.name || googleUser.email, googleUser.email]
      );
      accountId = accountResult.rows[0].id;

      const userResult = await query(
        `INSERT INTO users (instagram_user_id, username, display_name, avatar_url, role, account_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          googleUser.email,
          googleUser.email.split('@')[0],
          googleUser.name || googleUser.email,
          googleUser.picture || null,
          'creator',
          accountId,
        ]
      );
      userId = userResult.rows[0].id;
    }

    // Create session
    const crypto = require('crypto');
    const sessionToken = `google_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await ensureAuthSessions();
    await query(
      'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [sessionToken, userId, expiresAt]
    );

    // Set session cookie
    res.setHeader('Set-Cookie', [
      `valueskins_session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Secure`,
    ]);

    // Redirect to home or onboarding
    return res.redirect('/demo/instagram');
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.redirect(`/?error=callback_error&message=${encodeURIComponent(String(error))}`);
  }
}

async function ensureAuthSessions() {
  await query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
}
