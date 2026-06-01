import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, dealId, type, reminderDate } = req.body;
    if (!userId || !dealId || !type || !reminderDate) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    await query(
      `INSERT INTO deal_reminders (user_id, deal_id, type, reminder_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, deal_id, type) DO UPDATE SET reminder_date = $4`,
      [userId, dealId, type, reminderDate]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Schedule reminder error:', error);
    return res.status(500).json({ error: 'Failed' });
  }
}

export default withApiHandler(handler);
