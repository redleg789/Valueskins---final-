import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

interface FinancialConfig {
  platformFeePercent: number;
  paymentStructure: {
    upfrontPercent: number;
    onDeliveryPercent: number;
    onFinalPercent: number;
  };
  dealLimits: {
    minDealAmount: number;
    maxDealAmount: number;
    maxCreatorsPerBulk: number;
  };
  creatorDefaults: {
    minDealValue: number;
    exclusivityWindowDays: number;
  };
  qaDefaults: {
    freeRevisions: number;
    revisionChargeAmount: number;
  };
  payoutDefaults: {
    holdDaysAfterCompletion: number;
    payoutDayOfWeek: string;
  };
  brandDefaults: {
    verificationRequired: boolean;
    verificationCost: number;
  };
}

const DEFAULT_CONFIG: FinancialConfig = {
  platformFeePercent: 5,
  paymentStructure: {
    upfrontPercent: 50,
    onDeliveryPercent: 50,
    onFinalPercent: 0,
  },
  dealLimits: {
    minDealAmount: 100,
    maxDealAmount: 1000000,
    maxCreatorsPerBulk: 500,
  },
  creatorDefaults: {
    minDealValue: 0,
    exclusivityWindowDays: 30,
  },
  qaDefaults: {
    freeRevisions: 2,
    revisionChargeAmount: 50,
  },
  payoutDefaults: {
    holdDaysAfterCompletion: 7,
    payoutDayOfWeek: 'Friday',
  },
  brandDefaults: {
    verificationRequired: false,
    verificationCost: 0,
  },
};

const validateConfig = (config: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (typeof config.platformFeePercent !== 'number' || config.platformFeePercent < 0 || config.platformFeePercent > 100) {
    errors.push('platformFeePercent must be 0-100');
  }
  if (typeof config.paymentStructure?.upfrontPercent !== 'number' || config.paymentStructure.upfrontPercent < 0 || config.paymentStructure.upfrontPercent > 100) {
    errors.push('upfrontPercent must be 0-100');
  }
  if (typeof config.dealLimits?.minDealAmount !== 'number' || config.dealLimits.minDealAmount < 0) {
    errors.push('minDealAmount must be non-negative');
  }
  if (typeof config.dealLimits?.maxDealAmount !== 'number' || config.dealLimits.maxDealAmount <= 0) {
    errors.push('maxDealAmount must be positive');
  }
  if (config.dealLimits.minDealAmount > config.dealLimits.maxDealAmount) {
    errors.push('minDealAmount cannot exceed maxDealAmount');
  }
  if (typeof config.qaDefaults?.freeRevisions !== 'number' || config.qaDefaults.freeRevisions < 0) {
    errors.push('freeRevisions must be non-negative');
  }
  if (typeof config.payoutDefaults?.holdDaysAfterCompletion !== 'number' || config.payoutDefaults.holdDaysAfterCompletion < 0) {
    errors.push('holdDaysAfterCompletion must be non-negative');
  }

  return { valid: errors.length === 0, errors };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // All financial config endpoints require admin access (future: implement proper admin check)
    const userRole = req.headers['x-user-role'];
    const isAdmin = userRole === 'admin';

    if (req.method === 'GET') {
      // Fetch current config
      try {
        const result = await query(
          'SELECT config FROM financial_config WHERE id = 1'
        );

        if (result.rows.length === 0) {
          // Return defaults if not set
          return res.status(200).json({
            config: DEFAULT_CONFIG,
            isDefault: true,
            lastUpdated: null,
          });
        }

        return res.status(200).json({
          config: result.rows[0].config,
          isDefault: false,
          lastUpdated: result.rows[0].updated_at,
        });
      } catch (err) {
        // Table doesn't exist yet, return defaults
        return res.status(200).json({
          config: DEFAULT_CONFIG,
          isDefault: true,
          lastUpdated: null,
        });
      }
    }

    if (req.method === 'POST') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const newConfig = req.body;

      // Validate
      const validation = validateConfig(newConfig);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      // Ensure table exists
      await query(`
        CREATE TABLE IF NOT EXISTS financial_config (
          id INT PRIMARY KEY DEFAULT 1,
          config JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          updated_by TEXT
        )
      `).catch(() => {});

      // Upsert config
      await query(
        `INSERT INTO financial_config (id, config, updated_at, updated_by)
         VALUES (1, $1, NOW(), $2)
         ON CONFLICT (id) DO UPDATE SET config = $1, updated_at = NOW(), updated_by = $2`,
        [JSON.stringify(newConfig), userRole || 'system']
      );

      return res.status(200).json({
        success: true,
        config: newConfig,
        message: 'Financial configuration updated',
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === 'DELETE') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Reset to defaults
      await query(
        `DELETE FROM financial_config WHERE id = 1`
      ).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Configuration reset to defaults',
        config: DEFAULT_CONFIG,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[financial-config] Error:', {
      method: req.method,
      message: err.message,
      code: err.code,
    });
    return res.status(500).json({ error: 'Failed to manage financial config' });
  }
}
