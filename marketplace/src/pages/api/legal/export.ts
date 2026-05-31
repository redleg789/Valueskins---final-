import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { queryOne, query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const session = await queryOne(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE',
      [sessionToken]
    );
    if (!session) return res.status(401).json({ error: 'Session expired' });

    const userId = session.user_id;

    // Fetch user data
    const user = await queryOne('SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = $1', [userId]);
    const account = await queryOne('SELECT * FROM accounts WHERE user_id = $1', [userId]);

    // Build export object
    const exportData = {
      export_date: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
      profile: account || {},
    };

    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="valueskins-export-${Date.now()}.json"`);
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}

export default withApiHandler(handler, {
  allowedMethods: ['GET'],
  rateLimit: { maxRequests: 5, windowMs: 24 * 60 * 60 * 1000 },
});
