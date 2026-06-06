import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { queryOne } from '@/lib/db-pool';
import { sessionCache } from '@/lib/cache';

interface AccountResponse {
  id?: string;
  email?: string;
  display_name?: string;
  avatar_url?: string | null;
  role?: string;
  error?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse<AccountResponse>) {
  if (setupCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check cache first
    const cached = sessionCache.get(`session:${sessionToken}`);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Query database
    const session = await queryOne(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );

    if (!session) {
      res.setHeader('Set-Cookie', 'valueskins_session=; HttpOnly; Path=/; Max-Age=0');
      return res.status(401).json({ error: 'Session expired' });
    }

    const user = await queryOne(
      'SELECT id, email, display_name, avatar_url, role FROM users WHERE id = $1',
      [session.user_id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = {
      id: user.id,
      email: user.email,
      display_name: user.display_name || '',
      avatar_url: user.avatar_url || null,
      role: user.role || null,
    };

    // Cache for 5 minutes
    sessionCache.set(`session:${sessionToken}`, response, 5 * 60 * 1000);

    return res.status(200).json(response);
  } catch (error) {
    console.error('Account ME error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export default withApiHandler(handler, {
  allowedMethods: ['GET'],
  rateLimit: { maxRequests: 100, windowMs: 60000 },
});
