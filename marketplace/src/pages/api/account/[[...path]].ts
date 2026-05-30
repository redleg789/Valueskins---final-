import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path, ...queryParams } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : (path ?? '');

  const backendUrl = new URL(`${BACKEND_URL}/api/v1/account/${pathStr}`);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (typeof v === 'string') backendUrl.searchParams.set(k, v);
  });

  const cookie = req.headers.cookie;

  try {
    const backendRes = await fetch(backendUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(req.headers['x-session-id'] ? { 'X-Session-Id': req.headers['x-session-id'] as string } : {}),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await backendRes.json().catch(() => ({}));
    res.status(backendRes.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'Backend unavailable' });
  }
}
