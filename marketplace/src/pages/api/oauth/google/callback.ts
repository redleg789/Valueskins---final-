import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    await ensureAuthSessionsTable();

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('Token exchange failed:', errBody);
      return res.redirect('/?error=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();
    const idToken = tokens.id_token;

    if (!idToken) {
      return res.redirect('/?error=no_id_token');
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(idToken) as any;

    if (!decoded) {
      return res.redirect('/?error=invalid_id_token');
    }

    if (decoded.aud !== GOOGLE_CLIENT_ID) {
      return res.redirect('/?error=audience_mismatch');
    }

    const googleSub = decoded.sub as string;
    const email = decoded.email as string;
    const name = decoded.name as string || email?.split('@')[0] || 'User';
    const avatarUrl = decoded.picture as string || null;

    const username = email?.split('@')[0] || `user-${googleSub.substring(0, 8)}`;

    let userResult = await query(
      'SELECT id, display_name, avatar_url, username FROM users WHERE instagram_user_id = $1',
      [googleSub]
    );

    let userId: number;
    let accountId: number;
    if (userResult.rows.length === 0) {
      const aResult = await query(
        'INSERT INTO accounts (display_name, email, avatar_url, google_sub) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, email, avatarUrl, googleSub]
      );
      accountId = aResult.rows[0].id;

      const newUser = await query(
        `INSERT INTO users (instagram_user_id, username, display_name, avatar_url, role, account_id)
         VALUES ($1, $2, $3, $4, 'creator', $5)
         RETURNING id`,
        [googleSub, username, name, avatarUrl, accountId]
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
      const existing = await query('SELECT account_id FROM users WHERE id = $1', [userId]);
      if (!existing.rows[0]?.account_id) {
        const aResult = await query(
          'INSERT INTO accounts (display_name, email, avatar_url, google_sub) VALUES ($1, $2, $3, $4) ON CONFLICT (google_sub) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url RETURNING id',
          [name, email, avatarUrl, googleSub]
        );
        accountId = aResult.rows[0].id;
        await query('UPDATE users SET account_id = $1 WHERE id = $2', [accountId, userId]);
      }
      await query(
        `UPDATE users SET display_name = $1, avatar_url = $2, last_login_at = NOW()
         WHERE id = $3`,
        [name, avatarUrl, userId]
      );
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
      [sessionToken, userId, expiresAt]
    );

    const cookieValue = `valueskins_session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookieValue);

    // Check if onboarding is complete
    const accountCheck = await query(
      'SELECT onboarding_stage FROM accounts WHERE id = $1',
      [accountId]
    );

    const onboardingStage = accountCheck.rows[0]?.onboarding_stage || 'pending';

    if (onboardingStage !== 'complete') {
      return res.redirect(`/auth/onboarding-creator?userId=${userId}`);
    }

    // Check if creator has purchased a value scheme
    const hasValueScheme = await query(
      'SELECT 1 FROM user_stickers WHERE user_id = $1 AND is_active = TRUE',
      [userId]
    );

    if (hasValueScheme.rows.length === 0) {
      return res.redirect('/store');
    }

    return res.redirect('/');
  } catch (e: any) {
    console.error('OAuth callback error:', e);
    return res.redirect('/?error=oauth_failed');
  }
}

async function ensureAuthSessionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(id, is_active)
  `);
}
