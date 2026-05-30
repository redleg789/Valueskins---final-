import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface CreatorAgencySettings {
  minDealValue?: number;
  autoRejectBelowMin?: boolean;
  blockedBrands?: string[];
  blockedIndustries?: string[];
  maxTravelDistance?: number;
  exclusivityWindow?: number;
  requiredBrandVerification?: boolean;
  autoCounterPercentage?: number;
  preferences?: {
    hotelClass?: string;
    flightClass?: string;
    mealRestrictions?: string[];
    accessibilityNeeds?: string;
    maxHoursPerShoot?: number;
    shootTimePreference?: string;
    travelWilling?: boolean;
  };
}

const validateSettings = (settings: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (settings.minDealValue !== undefined && (typeof settings.minDealValue !== 'number' || settings.minDealValue < 0)) {
    errors.push('minDealValue must be a non-negative number');
  }
  if (settings.maxTravelDistance !== undefined && (typeof settings.maxTravelDistance !== 'number' || settings.maxTravelDistance < 0)) {
    errors.push('maxTravelDistance must be a non-negative number');
  }
  if (settings.exclusivityWindow !== undefined && (typeof settings.exclusivityWindow !== 'number' || settings.exclusivityWindow < 0 || settings.exclusivityWindow > 365)) {
    errors.push('exclusivityWindow must be 0-365 days');
  }
  if (settings.autoCounterPercentage !== undefined && (typeof settings.autoCounterPercentage !== 'number' || settings.autoCounterPercentage < 0 || settings.autoCounterPercentage > 100)) {
    errors.push('autoCounterPercentage must be 0-100');
  }
  if (Array.isArray(settings.blockedBrands)) {
    if (!settings.blockedBrands.every((b: any) => typeof b === 'string' && b.length > 0 && b.length <= 255)) {
      errors.push('blockedBrands must be array of non-empty strings (max 255 chars)');
    }
  }
  if (Array.isArray(settings.blockedIndustries)) {
    if (!settings.blockedIndustries.every((i: any) => typeof i === 'string' && i.length > 0 && i.length <= 255)) {
      errors.push('blockedIndustries must be array of non-empty strings (max 255 chars)');
    }
  }
  if (settings.preferences?.maxHoursPerShoot !== undefined && (typeof settings.preferences.maxHoursPerShoot !== 'number' || settings.preferences.maxHoursPerShoot <= 0)) {
    errors.push('maxHoursPerShoot must be positive number');
  }

  return { valid: errors.length === 0, errors };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader || typeof userIdHeader !== 'string') {
      return res.status(401).json({ error: 'Unauthorized: missing or invalid user ID' });
    }

    const userId = parseInt(userIdHeader, 10);
    if (isNaN(userId)) {
      return res.status(401).json({ error: 'Unauthorized: invalid user ID format' });
    }

    if (req.method === 'GET') {
      // Verify user exists and has creator module
      const userCheck = await query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const result = await query(
        'SELECT agency_settings FROM users WHERE id = $1',
        [userId]
      );

      const settings = result.rows[0]?.agency_settings || {};
      return res.status(200).json(settings);
    }

    if (req.method === 'POST') {
      const settings: CreatorAgencySettings = req.body;

      // Validate input
      if (typeof settings !== 'object' || settings === null) {
        return res.status(400).json({ error: 'Request body must be valid JSON object' });
      }

      const validation = validateSettings(settings);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validation failed', details: validation.errors });
      }

      // Verify user exists
      const userCheck = await query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Ensure column exists
      await query(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_settings JSONB DEFAULT \'{}\''
      ).catch(() => {});

      // Save settings
      await query(
        'UPDATE users SET agency_settings = COALESCE($1, agency_settings), updated_at = NOW() WHERE id = $2',
        [Object.keys(settings).length > 0 ? JSON.stringify(settings) : null, userId]
      );

      return res.status(200).json({ success: true, settings });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[agency-settings] Error:', {
      method: req.method,
      userId: req.headers['x-user-id'],
      message: err.message,
      code: err.code,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
