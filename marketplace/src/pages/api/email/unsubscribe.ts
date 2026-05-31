import { NextApiRequest, NextApiResponse } from 'next';
import { setupCors } from '@/lib/cors';
import { query, queryOne } from '@/lib/db-pool';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, type } = req.query;
    if (!email || !type) return res.status(400).json({ error: 'Missing parameters' });

    const validTypes = ['marketing', 'notifications', 'product_updates'];
    if (!validTypes.includes(type as string)) return res.status(400).json({ error: 'Invalid type' });

    const user = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const col = type as string;
    await query(
      `UPDATE user_email_preferences SET ${col} = FALSE WHERE user_id = $1`,
      [user.id]
    );

    return res.status(200).json({ message: 'Unsubscribed' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed' });
  }
}
