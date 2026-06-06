const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback';

// Debug logging
if (typeof window !== 'undefined' && !GOOGLE_CLIENT_ID) {
  console.error('⚠️ GOOGLE_CLIENT_ID is missing! Check Vercel env vars. Current env:', {
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
  });
}

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI || 'http://localhost:3000/api/oauth/github/callback';

function randomState(): string {
  const arr = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(arr);
  } else {
    // Server-side fallback
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getGoogleAuthUrl(customState?: string): string {
  const state = customState || randomState();
  const scope = 'openid profile email';
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope,
    state,
    access_type: 'offline',
  });

  if (typeof window !== 'undefined' && !customState) {
    sessionStorage.setItem('oauth_state', state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGitHubAuthUrl(): string {
  const state = randomState();
  const scope = 'user:email';
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope,
    state,
  });

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state);
  }

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<any> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: GOOGLE_REDIRECT_URI,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) throw new Error('Google token exchange failed');
  return response.json();
}

export async function exchangeGitHubCode(code: string): Promise<any> {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: GITHUB_REDIRECT_URI,
  });

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) throw new Error('GitHub token exchange failed');
  return response.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<any> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Failed to fetch Google user info');
  return response.json();
}

export async function getGitHubUserInfo(accessToken: string): Promise<any> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) throw new Error('Failed to fetch GitHub user info');
  return response.json();
}
