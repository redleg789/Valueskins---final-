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
  console.log('🔐 OAuth callback hit');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  if (error) {
    console.log('❌ Google error:', error);
    return res.redirect(`/?error=${error}`);
  }

  if (!code || typeof code !== 'string') {
    console.log('❌ Missing code');
    return res.status(400).json({ error: 'Missing code' });
  }

  try {
    console.log('🔄 Exchanging code for tokens...');
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.access_token) {
      console.log('❌ No access token');
      return res.status(400).json({ error: 'token_failed' });
    }

    console.log('✅ Got tokens');
    const googleUser = (await getGoogleUserInfo(tokens.access_token)) as GoogleUser;
    console.log('✅ Got user:', googleUser.email);

    if (!googleUser.email) {
      console.log('❌ No email');
      return res.status(400).json({ error: 'no_email' });
    }

    // Use email as instagram_user_id for OAuth users
    const instagramUserId = googleUser.email;

    let userId: number;
    let result = await query('SELECT id FROM users WHERE instagram_user_id = $1', [instagramUserId]);

    if (result.rows.length > 0) {
      userId = result.rows[0].id;
      console.log('✅ Found user:', userId);
      await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
    } else {
      console.log('🆕 Creating new user for:', googleUser.email);
      const createResult = await query(
        'INSERT INTO users (instagram_user_id, username, display_name, avatar_url, is_active, onboarding_stage) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [instagramUserId, googleUser.email.split('@')[0], googleUser.name || googleUser.email, googleUser.picture || null, true, 'pending']
      );
      userId = createResult.rows[0].id;
      console.log('✅ Created user:', userId);
    }

    const sessionId = generateUUID();
    const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);

    console.log('🔐 Creating session:', sessionId);
    await query(
      'INSERT INTO auth_sessions (id, user_id, is_active, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, userId, true, expiresAt]
    );

    const cookieStr = `valueskins_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
    res.setHeader('Set-Cookie', cookieStr);
    console.log('✅ Session cookie set');

    console.log('🚀 Redirecting to /');
    return res.redirect('/');
  } catch (error) {
    console.error('❌ OAuth error:', error);
    return res.status(500).json({
      error: 'auth_failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
