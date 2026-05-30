import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';
import type {
  PlatformFeeConfig, ProviderFeeOverride, PlatformFeeRecord,
  TransactionLedgerEntry, FeeCalculationResult, PaymentDashboardData,
  FeeType, PaymentProvider,
} from '@/features/events/data/types';
import {
  DEFAULT_PLATFORM_FEE_CENTS,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
} from '@/lib/platformFees';
import { getBusinessBankConfig } from '@/lib/businessBank';

// ── In-memory mock store ───────────────────────────────────

let feeConfig: PlatformFeeConfig = {
  id: 'fee-cfg-default',
  feeType: 'percentage',
  flatFeeCents: DEFAULT_PLATFORM_FEE_CENTS,
  percentageRate: DEFAULT_PLATFORM_FEE_PERCENTAGE,
  minFeeCents: null,
  maxFeeCents: null,
  description: 'Default platform fee: 2% of every ticket transaction',
  isActive: true,
  createdBy: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let providerOverrides: ProviderFeeOverride[] = [];

let feeRecords: PlatformFeeRecord[] = [];

let ledger: TransactionLedgerEntry[] = [];
let ticketPaymentSchemaReady = false;

async function ensureTicketPaymentSchema() {
  if (ticketPaymentSchemaReady) return;

  await query(`
    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS payment_provider TEXT,
      ADD COLUMN IF NOT EXISTS payment_order_ref TEXT,
      ADD COLUMN IF NOT EXISTS payment_ref TEXT,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
      ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_amount_cents INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fee_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS settlement_account_label TEXT
  `);

  ticketPaymentSchemaReady = true;
}

// ── Fee Calculation (mirrors Rust fee_engine) ──────────────

function calculateFee(
  amountCents: number,
  provider: string,
  config: PlatformFeeConfig,
  overrides: ProviderFeeOverride[],
): FeeCalculationResult {
  const override_ = overrides.find(o => o.provider === provider && o.isActive);
  const feeType: FeeType = override_?.feeType ?? config.feeType;
  const flatFeeCents: number = override_?.flatFeeCents ?? config.flatFeeCents;
  const percentageRate: number = override_?.percentageRate ?? config.percentageRate;
  const minFeeCents: number | null = config.minFeeCents;
  const maxFeeCents: number | null = config.maxFeeCents;

  const flatComponent = feeType === 'flat' || feeType === 'hybrid' ? flatFeeCents : 0;
  const percentageComponent = feeType === 'percentage' || feeType === 'hybrid'
    ? Math.round(amountCents * (percentageRate / 100))
    : 0;

  let total = flatComponent + percentageComponent;

  if (feeType === 'percentage') {
    if (minFeeCents !== null) total = Math.max(total, minFeeCents);
    if (maxFeeCents !== null) total = Math.min(total, maxFeeCents);
  }

  return {
    feeCents: total,
    netAmountCents: amountCents - total,
    breakdown: { flatComponent, percentageComponent, totalFeeCents: total },
    configUsed: override_ ?? config,
    provider,
  };
}

// ── Handler ────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const route = Array.isArray(path) ? path.join('/') : path || '';

  const [resource, ...rest] = route.split('/');
  const id = rest[0] || null;

  try {
    switch (resource) {
      // ── Fee Config ──────────────────────────────────────
      case 'config': {
        if (req.method === 'GET') {
          return res.status(200).json(feeConfig);
        }
        if (req.method === 'PUT' || req.method === 'PATCH') {
          const body = req.body;
          feeConfig = {
            ...feeConfig,
            feeType: body.feeType ?? feeConfig.feeType,
            flatFeeCents: body.flatFeeCents ?? feeConfig.flatFeeCents,
            percentageRate: body.percentageRate ?? feeConfig.percentageRate,
            minFeeCents: body.minFeeCents ?? feeConfig.minFeeCents,
            maxFeeCents: body.maxFeeCents ?? feeConfig.maxFeeCents,
            description: body.description ?? feeConfig.description,
            isActive: body.isActive ?? feeConfig.isActive,
            updatedAt: new Date().toISOString(),
          };
          return res.status(200).json(feeConfig);
        }
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ── Calculate Fee ───────────────────────────────────
      case 'calculate': {
        if (req.method === 'POST') {
          const { amountCents, provider } = req.body;
          if (typeof amountCents !== 'number' || amountCents < 0) {
            return res.status(400).json({ error: 'amountCents must be a positive number' });
          }
          const result = calculateFee(amountCents, provider || 'stripe', feeConfig, providerOverrides);
          return res.status(200).json(result);
        }
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ── Provider Overrides ──────────────────────────────
      case 'providers': {
        if (req.method === 'GET') {
          return res.status(200).json(providerOverrides);
        }
        if (req.method === 'POST') {
          const body = req.body;
          const existing = providerOverrides.findIndex(o => o.provider === body.provider);
          const override: ProviderFeeOverride = {
            id: body.id || `override-${Date.now()}`,
            provider: body.provider,
            feeType: body.feeType ?? null,
            flatFeeCents: body.flatFeeCents ?? null,
            percentageRate: body.percentageRate ?? null,
            isActive: body.isActive ?? true,
          };
          if (existing >= 0) {
            providerOverrides[existing] = override;
          } else {
            providerOverrides.push(override);
          }
          return res.status(200).json(override);
        }
        if (req.method === 'DELETE' && id) {
          providerOverrides = providerOverrides.filter(o => o.id !== id);
          return res.status(200).json({ deleted: true });
        }
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ── Fee Records ─────────────────────────────────────
      case 'fees': {
        if (req.method === 'GET') {
          const eventFilter = rest[1] === 'event' ? rest[2] : null;
          let result = feeRecords;
          if (eventFilter) result = result.filter(f => f.eventId === eventFilter);
          return res.status(200).json(result);
        }
        if (req.method === 'POST') {
          const body = req.body;
          const grossCents: number = body.grossAmountCents;
          const provider: string = body.provider || 'stripe';
          const calc = calculateFee(grossCents, provider, feeConfig, providerOverrides);
          const record: PlatformFeeRecord = {
            id: `fee-${Date.now()}`,
            transactionId: body.transactionId || `txn-${Date.now()}`,
            provider,
            grossAmountCents: grossCents,
            feeCents: calc.feeCents,
            netAmountCents: calc.netAmountCents,
            currency: body.currency || 'USD',
            status: 'collected',
            payerId: body.payerId || null,
            payeeId: body.payeeId || null,
            eventId: body.eventId || null,
            metadata: body.metadata || null,
            createdAt: new Date().toISOString(),
            collectedAt: new Date().toISOString(),
          };
          feeRecords.unshift(record);
          return res.status(201).json(record);
        }
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ── Transaction Ledger ──────────────────────────────
      case 'ledger': {
        if (req.method === 'GET') {
          return res.status(200).json(ledger);
        }
        if (req.method === 'POST') {
          const body = req.body;
          const grossCents: number = body.amountCents;
          const provider: string = body.provider || 'stripe';
          const calc = body.feeCents !== undefined
            ? { feeCents: body.feeCents, netAmountCents: grossCents - body.feeCents }
            : calculateFee(grossCents, provider, feeConfig, providerOverrides);

          const entry: TransactionLedgerEntry = {
            id: `ledger-${Date.now()}`,
            externalId: body.externalId || null,
            provider,
            type: body.type || 'payment',
            amountCents: grossCents,
            currency: body.currency || 'USD',
            grossAmountCents: grossCents + (body.providerFeeCents || 0),
            feeCents: calc.feeCents,
            netAmountCents: calc.netAmountCents,
            status: body.status || 'succeeded',
            payerId: body.payerId || null,
            payeeId: body.payeeId || null,
            eventId: body.eventId || null,
            idempotencyKey: body.idempotencyKey || null,
            description: body.description || null,
            metadata: body.metadata || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          ledger.unshift(entry);
          return res.status(201).json(entry);
        }
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ── Dashboard ───────────────────────────────────────
      case 'dashboard': {
        if (req.method === 'GET') {
          let totalRevenueCents = ledger
            .filter(e => e.type === 'payment' && e.status === 'succeeded')
            .reduce((s, e) => s + e.amountCents, 0);
          let totalFeesCents = feeRecords
            .filter(f => f.status === 'collected')
            .reduce((s, f) => s + f.feeCents, 0);
          let pendingFeesCents = feeRecords
            .filter(f => f.status === 'pending')
            .reduce((s, f) => s + f.feeCents, 0);
          let virtualBank: PaymentDashboardData['virtualBank'] = null;
          let totalTransactions = ledger.filter(e => e.type === 'payment').length;

          try {
            await ensureTicketPaymentSchema();

            const stats = await query(
              `SELECT
                 COUNT(*) FILTER (WHERE payment_provider = 'razorpay' AND fee_status = 'collected')::int AS ticket_count,
                 COALESCE(SUM(price_cents) FILTER (WHERE payment_provider = 'razorpay' AND fee_status = 'collected'), 0)::int AS gross_sales_cents,
                 COALESCE(SUM(platform_fee_cents) FILTER (WHERE payment_provider = 'razorpay' AND fee_status = 'collected'), 0)::int AS fee_revenue_cents,
                 COALESCE(SUM(net_amount_cents) FILTER (WHERE payment_provider = 'razorpay' AND fee_status = 'collected'), 0)::int AS net_sales_cents,
                 COALESCE(SUM(platform_fee_cents) FILTER (WHERE payment_provider = 'razorpay' AND fee_status = 'pending'), 0)::int AS pending_fee_cents,
                 MAX(created_at) FILTER (WHERE payment_provider = 'razorpay') AS last_payment_at
               FROM tickets`
            );

            if (stats.rows.length > 0) {
              const row = stats.rows[0];
              totalRevenueCents = Number(row.gross_sales_cents || 0);
              totalFeesCents = Number(row.fee_revenue_cents || 0);
              pendingFeesCents = Number(row.pending_fee_cents || 0);
              totalTransactions = Number(row.ticket_count || 0);

              const bank = getBusinessBankConfig();
              virtualBank = {
                label: bank.label,
                bankName: bank.bankName,
                accountHolderName: bank.accountHolderName,
                accountNumberMasked: `${'*'.repeat(Math.max(bank.accountNumber.length - 4, 0))}${bank.accountNumber.slice(-4)}`,
                ifsc: bank.ifsc,
                currentBalanceCents: totalFeesCents,
                netTicketSalesCents: Number(row.net_sales_cents || 0),
                ticketsSoldCount: Number(row.ticket_count || 0),
                lastPaymentAt: row.last_payment_at || null,
              };
            }
          } catch {
            virtualBank = null;
          }

          const dashboard: PaymentDashboardData = {
            totalRevenueCents,
            totalFeesCents,
            totalTransactions,
            pendingFeesCents,
            collectedFeesCents: totalFeesCents,
            feeConfig,
            recentTransactions: ledger.slice(0, 10),
            recentFees: feeRecords.slice(0, 10),
            providerOverrides,
            virtualBank,
          };
          return res.status(200).json(dashboard);
        }
        return res.status(405).json({ error: 'Method not allowed' });
      }

      default:
        return res.status(404).json({ error: `Unknown resource: ${resource}` });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
