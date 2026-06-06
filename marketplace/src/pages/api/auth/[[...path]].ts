import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback';

const FULL_MODULES = [
  { code: 'explorer', is_active: true, activated_at: new Date().toISOString() },
  { code: 'host', is_active: true, activated_at: new Date().toISOString() },
  { code: 'valueskin', is_active: true, activated_at: new Date().toISOString() },
  { code: 'brand', is_active: true, activated_at: new Date().toISOString() },
  { code: 'community', is_active: true, activated_at: new Date().toISOString() },
];

function formatUserData(row: any) {
  // Determine modules based on user role
  const userRole = row.role || 'creator';
  let activeModules = FULL_MODULES.map(m => ({
    ...m,
    is_active: false,
  }));

  // Always active for everyone
  activeModules = activeModules.map(m => ({
    ...m,
    is_active: m.is_active || m.code === 'explorer',
  }));

  // Role-specific modules
  if (userRole === 'creator') {
    activeModules = activeModules.map(m => ({
      ...m,
      is_active: m.is_active || m.code === 'valueskin',
    }));
  } else if (userRole === 'brand') {
    activeModules = activeModules.map(m => ({
      ...m,
      is_active: m.is_active || m.code === 'brand',
    }));
  } else if (userRole === 'host') {
    activeModules = activeModules.map(m => ({
      ...m,
      is_active: m.is_active || m.code === 'host',
    }));
  }

  return {
    id: Number(row.id),
    email: (row.instagram_user_id || '').includes('@') ? row.instagram_user_id : `${row.username || 'user'}@valueskins.local`,
    phone: null,
    email_verified: true,
    phone_verified: false,
    display_name: row.display_name || row.username || 'User',
    avatar_url: row.avatar_url || null,
    preferred_locale: 'en',
    is_active: row.is_active !== false,
    is_locked: false,
    onboarding_stage: row.onboarding_stage || 'complete',
    preferences: [],
    modules: activeModules,
    totp_enabled: false,
    created_at: row.created_at || new Date().toISOString(),
    last_login_at: row.last_login_at || new Date().toISOString(),
    role: row.role || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : (path ?? '');

  const cookie = req.headers.cookie || '';

  async function getSessionUser() {
    const match = cookie.match(/valueskins_session=([^;]+)/);
    if (!match) return null;

    const sessionToken = match[1];
    const result = await query(
      `SELECT u.id, u.instagram_user_id, u.username, u.display_name, u.avatar_url,
              u.is_active, u.created_at, u.last_login_at, u.role, u.onboarding_stage
       FROM auth_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.is_active = true AND s.expires_at > NOW()`,
      [sessionToken]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  // ── GET /api/auth/google — redirect to Google OAuth ──
  if (req.method === 'GET' && pathStr === 'google') {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  // ── POST /api/auth/dev/login — dev bypass ──
  if (req.method === 'POST' && pathStr === 'dev/login') {
    let userId: number;
    let accountId: number;
    const existing = await query('SELECT id FROM users WHERE instagram_user_id = $1', ['dev-user']);
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      const existingAcct = await query('SELECT account_id FROM users WHERE id = $1', [userId]);
      if (!existingAcct.rows[0]?.account_id) {
        const aResult = await query(
          "INSERT INTO accounts (display_name, email) VALUES ('Dev User', 'dev@valueskins.local') RETURNING id"
        );
        accountId = aResult.rows[0].id;
        await query('UPDATE users SET account_id = $1 WHERE id = $2', [accountId, userId]);
      }
    } else {
      const aResult = await query(
        "INSERT INTO accounts (display_name, email) VALUES ('Dev User', 'dev@valueskins.local') RETURNING id"
      );
      accountId = aResult.rows[0].id;
      const created = await query(
        `INSERT INTO users (instagram_user_id, username, display_name, role, account_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ['dev-user', 'dev', 'Dev User', 'creator', accountId]
      );
      userId = created.rows[0].id;
    }

    const crypto = require('crypto');
    const sessionToken = `dev_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await ensureAuthSessions();
    await query(
      'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [sessionToken, userId, expiresAt]
    );

    res.setHeader('Set-Cookie', [
      `valueskins_session=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
    ]);

    const userRow = (await query('SELECT * FROM users WHERE id = $1', [userId])).rows[0];
    return res.status(200).json({
      account: formatUserData(userRow),
      session_id: sessionToken,
    });
  }

  // ── GET /api/auth/me — get current user ──
  if (req.method === 'GET' && pathStr === 'me') {
    const userRow = await getSessionUser();
    if (!userRow) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.status(200).json(formatUserData(userRow));
  }

  // ── POST /api/auth/logout — clear session ──
  if (req.method === 'POST' && pathStr === 'logout') {
    const match = cookie.match(/valueskins_session=([^;]+)/);
    if (match) {
      await query('UPDATE auth_sessions SET is_active = false WHERE id = $1', [match[1]]);
    }
    res.setHeader('Set-Cookie', [
      'valueskins_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
    ]);
    return res.status(200).json({ message: 'Logged out' });
  }

  // ── POST /api/auth/delete-account — delete user and all data ──
  if (req.method === 'POST' && pathStr === 'delete-account') {
    const match = cookie.match(/valueskins_session=([^;]+)/);
    if (!match) return res.status(401).json({ error: 'Not authenticated' });
    const sessionToken = match[1];
    const sessionResult = await query(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = true',
      [sessionToken]
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session invalid' });
    const userId = sessionResult.rows[0].user_id;
    await query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);
    res.setHeader('Set-Cookie', ['valueskins_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0']);
    return res.status(200).json({ success: true });
  }

  // ── POST /api/auth/email/verify — mock ──
  if (req.method === 'POST' && pathStr === 'email/verify') {
    return res.status(200).json({ message: 'Email verified' });
  }

  if (req.method === 'POST' && pathStr === 'email/resend') {
    return res.status(200).json({ message: 'Verification email sent' });
  }

  // ── POST /api/auth/phone/request-otp — mock ──
  if (req.method === 'POST' && pathStr === 'phone/request-otp') {
    return res.status(200).json({ message: 'OTP sent to phone' });
  }

  if (req.method === 'POST' && pathStr === 'phone/verify-otp') {
    res.setHeader('Set-Cookie', [
      'valueskins_phone_verified=true; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600',
    ]);
    return res.status(200).json({ message: 'Phone verified' });
  }

  return res.status(404).json({ error: 'Not found' });
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
