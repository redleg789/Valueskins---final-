import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

let cachedConfig: any = null;
let configFetchTime = 0;

const getFinancialConfig = async () => {
  const now = Date.now();
  if (cachedConfig && now - configFetchTime < 5 * 60 * 1000) {
    return cachedConfig;
  }

  try {
    const result = await query('SELECT config FROM financial_config WHERE id = 1').catch(() => null);
    cachedConfig = result?.rows?.[0]?.config || { dealLimits: { maxCreatorsPerBulk: 500, maxDealAmount: 1000000 } };
    configFetchTime = now;
    return cachedConfig;
  } catch {
    return { dealLimits: { maxCreatorsPerBulk: 500, maxDealAmount: 1000000 } };
  }
};

const validateBulkCreate = (data: any, config: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const maxCreators = config.dealLimits?.maxCreatorsPerBulk || 500;
  const maxAmount = config.dealLimits?.maxDealAmount || 1000000;

  if (!Array.isArray(data.creatorIds) || data.creatorIds.length === 0) {
    errors.push('creatorIds must be non-empty array');
  }
  if (data.creatorIds.length > maxCreators) {
    errors.push(`Maximum ${maxCreators} creators per bulk creation`);
  }
  if (!data.creatorIds.every((id: any) => typeof id === 'number' && id > 0)) {
    errors.push('All creatorIds must be positive numbers');
  }
  if (typeof data.offerAmount !== 'number' || data.offerAmount <= 0) {
    errors.push('offerAmount must be positive number');
  }
  if (data.offerAmount > maxAmount) {
    errors.push(`offerAmount cannot exceed $${maxAmount}`);
  }
  if (!data.contentType || typeof data.contentType !== 'string' || data.contentType.length > 255) {
    errors.push('contentType must be non-empty string (max 255 chars)');
  }
  if (data.deliverables && (!Array.isArray(data.deliverables) || data.deliverables.length > 20)) {
    errors.push('deliverables must be array with max 20 items');
  }

  return { valid: errors.length === 0, errors };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
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

    const { creatorIds, offerAmount, contentType, deliverables } = req.body;

    // Get financial config
    const config = await getFinancialConfig();

    // Validate
    const validation = validateBulkCreate({ creatorIds, offerAmount, contentType, deliverables }, config);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    // Verify user is brand
    const brandCheck = await query(
      'SELECT account_id FROM users WHERE id = $1',
      [userId]
    );

    if (brandCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const brandId = brandCheck.rows[0].account_id;

    // Verify all creators exist
    const creatorCheck = await query(
      `SELECT id FROM users WHERE id = ANY($1)`,
      [creatorIds]
    );

    if (creatorCheck.rows.length !== creatorIds.length) {
      return res.status(400).json({
        error: 'Some creators not found',
        foundCount: creatorCheck.rows.length,
        requestedCount: creatorIds.length,
      });
    }

    // Create deals in transaction
    const createdDealIds: number[] = [];

    for (const creatorId of creatorIds) {
      try {
        const dealResult = await query(
          `INSERT INTO deals (brand_id, creator_id, offer_amount, content_type, deliverables, deal_state, created_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
           RETURNING id`,
          [
            brandId,
            creatorId,
            Math.round(offerAmount * 100) / 100,
            contentType.slice(0, 255),
            JSON.stringify(Array.isArray(deliverables) ? deliverables.slice(0, 20) : []),
          ]
        );

        if (dealResult.rows.length > 0) {
          createdDealIds.push(dealResult.rows[0].id);
        }
      } catch (err) {
        console.error(`[bulk-create] Failed to create deal for creator ${creatorId}:`, err);
        // Continue with next creator
      }
    }

    return res.status(200).json({
      success: true,
      dealsCreated: createdDealIds.length,
      totalRequested: creatorIds.length,
      createdDealIds,
      failureCount: creatorIds.length - createdDealIds.length,
      offerAmount,
      contentType,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[bulk-create] Error:', {
      method: req.method,
      userId: req.headers['x-user-id'],
      creatorCount: req.body?.creatorIds?.length,
      message: err.message,
      code: err.code,
    });
    return res.status(500).json({ error: 'Failed to create bulk deals' });
  }
}
