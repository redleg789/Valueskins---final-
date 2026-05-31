import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sessionToken = req.cookies.valueskins_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionResult = await query(
      'SELECT user_id, is_active, expires_at FROM auth_sessions WHERE id = $1',
      [sessionToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const expiresAt = new Date(session.expires_at);

    if (!session.is_active || expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const userId = session.user_id;

    const userResult = await query(
      `SELECT
        id,
        display_name,
        avatar_url,
        username,
        instagram_user_id as google_sub,
        account_id
      FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get account data
    const accountResult = await query(
      `SELECT
        id,
        email,
        phone,
        email_verified,
        phone_verified,
        display_name,
        avatar_url,
        onboarding_stage,
        preferences,
        totp_enabled,
        created_at
      FROM accounts WHERE id = $1`,
      [user.account_id]
    );

    const account = accountResult.rows[0] || {
      id: user.account_id,
      email: null,
      phone: null,
      email_verified: false,
      phone_verified: false,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      onboarding_stage: 'pending',
      preferences: [],
      modules: [],
      totp_enabled: false,
      created_at: new Date().toISOString(),
    };

    // Get active modules
    const modulesResult = await query(
      `SELECT code, is_active FROM account_modules WHERE account_id = $1`,
      [user.account_id]
    );

    const modules = modulesResult.rows || [];

    return res.status(200).json({
      data: {
        id: account.id,
        email: account.email,
        phone: account.phone,
        email_verified: account.email_verified,
        phone_verified: account.phone_verified,
        display_name: account.display_name,
        avatar_url: account.avatar_url,
        onboarding_stage: account.onboarding_stage,
        preferences: account.preferences || [],
        modules: modules.map((m: any) => ({ code: m.code, is_active: m.is_active })),
        totp_enabled: account.totp_enabled,
        created_at: account.created_at,
      },
    });
  } catch (error) {
    console.error('Account me endpoint error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
