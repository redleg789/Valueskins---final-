import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { creatorId, brandId, dealId } = req.body;

    // Validate inputs
    if (typeof creatorId !== 'number' || typeof brandId !== 'number') {
      return res.status(400).json({ error: 'Invalid creatorId or brandId' });
    }

    // Verify creator exists
    const creatorCheck = await query(
      'SELECT id, agency_settings FROM users WHERE id = $1',
      [creatorId]
    );

    if (creatorCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Verify brand exists
    const brandCheck = await query(
      'SELECT id, display_name, industry FROM accounts WHERE id = $1',
      [brandId]
    );

    if (brandCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const settings = creatorCheck.rows[0].agency_settings || {};
    const exclusivityWindow = Math.max(0, Math.min(365, settings.exclusivityWindow || 30)); // 0-365 days
    const brandIndustry = brandCheck.rows[0].industry || '';
    const brandName = brandCheck.rows[0].display_name || '';

    // Query active deals with parameterized INTERVAL
    const activeDeals = await query(
      `SELECT d.id, d.created_at, a.display_name as brand_name, a.industry
       FROM deals d
       JOIN accounts a ON d.brand_id = a.id
       WHERE d.creator_id = $1
       AND d.deal_state IN ('accepted', 'softhold', 'checklist')
       AND d.created_at > NOW() - INTERVAL '1 day' * $2
       AND d.id != $3`,
      [creatorId, exclusivityWindow, dealId || -1]
    );

    const conflicts: any[] = [];

    // Check for industry conflicts
    for (const activeDeal of activeDeals.rows) {
      if (activeDeal.industry && activeDeal.industry === brandIndustry) {
        const expiresAt = new Date(activeDeal.created_at);
        expiresAt.setDate(expiresAt.getDate() + exclusivityWindow);

        conflicts.push({
          type: 'industry_exclusivity',
          dealId: activeDeal.id,
          brandName: activeDeal.brand_name,
          industry: activeDeal.industry,
          expiresAt: expiresAt.toISOString(),
          reason: `Same industry exclusivity (${exclusivityWindow} day window)`,
        });
      }
    }

    // Check creator's blocked brands list
    const blockedBrands = Array.isArray(settings.blockedBrands) ? settings.blockedBrands : [];
    if (blockedBrands.includes(brandName)) {
      conflicts.push({
        type: 'brand_blocked',
        reason: 'Brand is blocked by creator',
        brandName,
      });
    }

    return res.status(200).json({
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts,
      canProceed: conflicts.length === 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[exclusivity-check] Error:', {
      method: req.method,
      creatorId: req.body?.creatorId,
      brandId: req.body?.brandId,
      message: err.message,
      code: err.code,
    });
    return res.status(500).json({ error: 'Failed to check exclusivity' });
  }
}
