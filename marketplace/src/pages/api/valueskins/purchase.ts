import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookie = req.headers.cookie || '';
  const userId = await getSessionUserId(cookie);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { profession_id, profession_name, tier = 1 } = req.body;

  if (!profession_id && !profession_name) {
    return res.status(400).json({ error: 'profession_id or profession_name is required' });
  }

  try {
    // Resolve profession_id if only profession_name provided
    let resolvedProfessionId = profession_id;
    if (!resolvedProfessionId && profession_name) {
      const profResult = await query(
        'SELECT id FROM professions WHERE name = $1 LIMIT 1',
        [profession_name]
      );
      if (profResult.rows.length === 0) {
        return res.status(400).json({ error: `Profession "${profession_name}" not found` });
      }
      resolvedProfessionId = profResult.rows[0].id;
    }

    // Check if user already has this profession sticker
    const existing = await query(
      'SELECT id FROM user_stickers WHERE user_id = $1 AND profession_id = $2 AND is_active = TRUE',
      [userId, resolvedProfessionId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already own a value scheme for this profession' });
    }

    // Generate unique valueskin code
    let valueskinCode: string;
    let attempts = 0;
    do {
      const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
      valueskinCode = `VS-${randomStr}-${timestamp}`;

      const check = await query(
        'SELECT 1 FROM user_stickers WHERE valueskin_code = $1',
        [valueskinCode]
      );
      if (check.rows.length === 0) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique valueskin code' });
    }

    // For testing: skip payment, grant immediately
    const result = await query(
      `INSERT INTO user_stickers (user_id, profession_id, tier, payment_method, amount_paid_cents, is_active, valueskin_code)
       VALUES ($1, $2, $3, 'test', $4, TRUE, $5)
       RETURNING id, valueskin_code`,
      [userId, resolvedProfessionId, tier, 0, valueskinCode]
    );

    return res.status(200).json({
      success: true,
      sticker: result.rows[0],
      message: 'Value scheme granted successfully'
    });
  } catch (err: any) {
    console.error('Purchase error:', err);
    return res.status(500).json({ error: err.message || 'Failed to purchase value scheme' });
  }
}
