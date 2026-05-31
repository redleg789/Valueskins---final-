import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { queryOne, query } from '@/lib/db-pool';
import { sessionCache } from '@/lib/cache';
import { UpdateAccountSchema, validateInput } from '@/lib/validation';

interface UpdateResponse {
  id?: string;
  display_name?: string;
  avatar_url?: string | null;
  error?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse<UpdateResponse>) {
  if (setupCors(req, res)) return;

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate input
    const validation = validateInput(UpdateAccountSchema, req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { display_name, avatar_url } = validation.data!;

    // Get session
    const session = await queryOne(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );

    if (!session) {
      res.setHeader('Set-Cookie', 'valueskins_session=; HttpOnly; Path=/; Max-Age=0');
      return res.status(401).json({ error: 'Session expired' });
    }

    // Update user
    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (display_name) {
      updates.push(`display_name = $${paramIdx++}`);
      params.push(display_name);
    }

    if (avatar_url) {
      updates.push(`avatar_url = $${paramIdx++}`);
      params.push(avatar_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(session.user_id);

    const sql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING id, display_name, avatar_url
    `;

    const result = await queryOne(sql, params);

    // Clear cache
    sessionCache.delete(`session:${sessionToken}`);
    sessionCache.delete(`user:${session.user_id}`);

    return res.status(200).json({
      id: result.id,
      display_name: result.display_name || '',
      avatar_url: result.avatar_url || null,
    });
  } catch (error) {
    console.error('Account update error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export default withApiHandler(handler, {
  allowedMethods: ['PATCH'],
  rateLimit: { maxRequests: 30, windowMs: 60000 },
});
