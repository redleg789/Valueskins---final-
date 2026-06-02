import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeGoogleCode, getGoogleUserInfo } from '@/lib/oauth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.redirect('/auth/login?error=missing_code');
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Try login first
    const loginRes = await fetch(`${BACKEND_URL}/auth/unified/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_token: tokens.id_token }),
    });

    if (loginRes.status === 401) {
      // No account — auto-signup
      const signupRes = await fetch(`${BACKEND_URL}/auth/unified/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_token: tokens.id_token,
          display_name: userInfo.name || userInfo.given_name || 'User',
        }),
      });

      if (!signupRes.ok) {
        const errData = await signupRes.json().catch(() => ({}));
        return res.redirect(`/auth/login?error=${encodeURIComponent(errData.error || 'signup_failed')}`);
      }

      const setCookie = signupRes.headers.get('set-cookie');
      if (setCookie) res.setHeader('Set-Cookie', setCookie);
      const data = await signupRes.json();
      return res.redirect(data.account?.onboarding_stage === 'complete' ? '/' : '/auth/onboarding');
    }

    if (!loginRes.ok) {
      const errData = await loginRes.json().catch(() => ({}));
      if (errData.requires_2fa) {
        return res.redirect(`/auth/2fa?token=${encodeURIComponent(tokens.id_token)}`);
      }
      return res.redirect(`/auth/login?error=${encodeURIComponent(errData.error || 'login_failed')}`);
    }

    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) res.setHeader('Set-Cookie', setCookie);

    const data = await loginRes.json();
    const destination = data.account?.onboarding_stage === 'complete' ? '/' : '/auth/onboarding';
    res.redirect(destination);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect('/auth/login?error=oauth_failed');
  }
}
