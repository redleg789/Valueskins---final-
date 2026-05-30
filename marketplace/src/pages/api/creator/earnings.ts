import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

let cachedConfig: any = null;
let configFetchTime = 0;

const getFinancialConfig = async () => {
  const now = Date.now();
  // Cache config for 5 minutes
  if (cachedConfig && now - configFetchTime < 5 * 60 * 1000) {
    return cachedConfig;
  }

  try {
    const result = await query('SELECT config FROM financial_config WHERE id = 1').catch(() => null);
    cachedConfig = result?.rows?.[0]?.config || { platformFeePercent: 5 };
    configFetchTime = now;
    return cachedConfig;
  } catch {
    return { platformFeePercent: 5 }; // fallback
  }
};

const calculateCreatorEarnings = (offerAmount: number, platformFeePercent: number): number => {
  if (typeof offerAmount !== 'number' || offerAmount < 0) return 0;
  if (typeof platformFeePercent !== 'number' || platformFeePercent < 0 || platformFeePercent > 100) platformFeePercent = 5;
  return Math.round((offerAmount * (100 - platformFeePercent)) / 100 * 100) / 100; // cents precision
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader || typeof userIdHeader !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = parseInt(userIdHeader, 10);
    if (isNaN(userId)) {
      return res.status(401).json({ error: 'Invalid user ID' });
    }

    // Verify user exists as creator
    const userCheck = await query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all completed deals for creator (approved state = paid or awaiting payment)
    const dealsResult = await query(
      `SELECT d.id, d.offer_amount, d.deal_state, d.created_at, d.posting_deadline,
              a.display_name as brand_name,
              COALESCE(d.payment_status, 'pending') as payment_status
       FROM deals d
       JOIN accounts a ON d.brand_id = a.id
       WHERE d.creator_id = $1
       AND d.deal_state IN ('approved', 'checklist')
       ORDER BY d.created_at DESC`,
      [userId]
    );

    const deals = dealsResult.rows;

    // Get financial config
    const config = await getFinancialConfig();
    const platformFeePercent = config.platformFeePercent || 5;

    // Calculate summary
    let totalEarned = 0;
    let totalPending = 0;
    let totalPaid = 0;

    const paidDeals: any[] = [];
    const pendingDeals: any[] = [];
    const monthlyEarnings: { [key: string]: number } = {};

    for (const deal of deals) {
      if (deal.deal_state === 'approved') {
        const creatorEarnings = calculateCreatorEarnings(deal.offer_amount, platformFeePercent);
        totalEarned += creatorEarnings;

        const dealData = {
          id: deal.id,
          brandName: deal.brand_name,
          amount: deal.offer_amount,
          creatorEarnings,
          status: deal.payment_status,
          createdAt: deal.created_at,
          postingDeadline: deal.posting_deadline,
        };

        if (deal.payment_status === 'paid') {
          totalPaid += creatorEarnings;
          paidDeals.push(dealData);
        } else {
          totalPending += creatorEarnings;
          pendingDeals.push(dealData);
        }

        // Monthly breakdown (by deal creation date)
        const monthKey = new Date(deal.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        });
        monthlyEarnings[monthKey] = (monthlyEarnings[monthKey] || 0) + creatorEarnings;
      }
    }

    return res.status(200).json({
      summary: {
        totalEarned: Math.round(totalEarned * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        platformFeePercent,
        currency: 'USD',
      },
      deals: {
        paid: paidDeals,
        pending: pendingDeals,
        totalCount: paidDeals.length + pendingDeals.length,
      },
      monthlyBreakdown: monthlyEarnings,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[earnings] Error:', {
      method: req.method,
      userId: req.headers['x-user-id'],
      message: err.message,
      code: err.code,
    });
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
}
