import type { NextApiRequest, NextApiResponse } from 'next';
import { query, transaction } from '@/lib/db';
import { getSessionUserId, getAccountId } from '@/lib/session';
import { createOrder, verifySignature } from '@/lib/razorpay';
import { getBusinessBankConfig } from '@/lib/businessBank';
import { calculatePlatformFee, DEFAULT_PAYMENT_CURRENCY } from '@/lib/platformFees';

const ok = (r: NextApiResponse, d: any) => r.status(200).json(d);
const created = (r: NextApiResponse, d: any) => r.status(201).json(d);
const bad = (r: NextApiResponse, m: string) => r.status(400).json({ error: m });
const notFound = (r: NextApiResponse) => r.status(404).json({ error: 'Not found' });
const unauthorized = (r: NextApiResponse) => r.status(401).json({ error: 'Unauthorized' });
const serverError = (r: NextApiResponse, m: string) => r.status(500).json({ error: m });

let brandPaymentSchemaReady = false;

async function ensureBrandPaymentSchema() {
  if (brandPaymentSchemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS brand_registrations (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL UNIQUE,
      registration_fee_cents INTEGER NOT NULL DEFAULT 0,
      payment_provider TEXT,
      payment_order_ref TEXT,
      payment_ref TEXT,
      currency TEXT DEFAULT 'INR',
      platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      net_amount_cents INTEGER NOT NULL DEFAULT 0,
      fee_status TEXT DEFAULT 'pending',
      settlement_account_label TEXT,
      status TEXT DEFAULT 'pending',
      activated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_brand_registrations_account ON brand_registrations(account_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_brand_registrations_payment_ref ON brand_registrations(payment_ref)');
  await query('CREATE INDEX IF NOT EXISTS idx_brand_registrations_payment_order_ref ON brand_registrations(payment_order_ref)');

  brandPaymentSchemaReady = true;
}

async function getAccountSummary(accountId: number) {
  const result = await query(
    `SELECT id, display_name, email FROM accounts WHERE id = $1 LIMIT 1`,
    [accountId]
  );
  return result.rows[0] || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path || '';
  const cookie = req.headers.cookie || '';
  const sessionUser = await getSessionUserId(cookie);
  const accountId = await getAccountId(cookie);

  if (!sessionUser || !accountId) return unauthorized(res);

  const parts = pathStr.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];

  try {
    switch (resource) {
      // ── BRAND REGISTRATION ──
      case 'register': {
        if (req.method === 'POST' && id === 'create-order') {
          if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return bad(res, 'Missing Razorpay credentials in marketplace/.env.local');
          }

          await ensureBrandPaymentSchema();

          const { registrationFeeCents } = req.body || {};
          if (registrationFeeCents === undefined || registrationFeeCents === null) {
            return bad(res, 'registrationFeeCents required');
          }

          const feeCentsNum = parseInt(String(registrationFeeCents), 10);
          if (Number.isNaN(feeCentsNum) || feeCentsNum < 0) {
            return bad(res, 'Invalid registrationFeeCents');
          }

          // Check if already registered
          const existing = await query(
            `SELECT * FROM brand_registrations WHERE account_id = $1 AND status = 'completed'`,
            [accountId]
          );
          if (existing.rows.length > 0) {
            return bad(res, 'Brand already registered');
          }

          // Check for pending registration
          const pendingReg = await query(
            `SELECT * FROM brand_registrations WHERE account_id = $1 AND status IN ('pending', 'payment_verified')`,
            [accountId]
          );
          if (pendingReg.rows.length > 0) {
            return bad(res, 'Brand registration already in progress');
          }

          const accountRow = await getAccountSummary(accountId);
          if (!accountRow) return notFound(res);

          const feeBreakdown = calculatePlatformFee(feeCentsNum);
          const businessBank = getBusinessBankConfig();
          const order = await createOrder({
            amount: feeCentsNum,
            currency: DEFAULT_PAYMENT_CURRENCY,
            receipt: `brand_${accountId}_${Date.now()}`,
            notes: {
              source: 'valueskins_brand_registration',
              account_id: String(accountId),
              platform_fee_cents: String(feeBreakdown.feeCents),
              net_amount_cents: String(feeBreakdown.netAmountCents),
              settlement_account_label: businessBank.label,
            },
          });

          if (!order.success) {
            return serverError(res, 'Failed to create Razorpay order');
          }

          // Create pending registration record
          const regResult = await query(
            `INSERT INTO brand_registrations (
              account_id, registration_fee_cents, currency,
              platform_fee_cents, net_amount_cents, fee_status, settlement_account_label, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (account_id) DO UPDATE SET
              registration_fee_cents = $2,
              status = 'pending',
              updated_at = NOW()
            RETURNING *`,
            [
              accountId,
              feeCentsNum,
              DEFAULT_PAYMENT_CURRENCY,
              feeBreakdown.feeCents,
              feeBreakdown.netAmountCents,
              'pending',
              businessBank.label,
              'pending',
            ]
          );

          return ok(res, {
            keyId: process.env.RAZORPAY_KEY_ID,
            order: order.data,
            account: {
              id: String(accountRow.id),
              displayName: accountRow.display_name,
              email: accountRow.email,
            },
            pricing: {
              grossAmountCents: feeBreakdown.grossAmountCents,
              platformFeeCents: feeBreakdown.feeCents,
              netAmountCents: feeBreakdown.netAmountCents,
              currency: DEFAULT_PAYMENT_CURRENCY,
            },
          });
        }

        if (req.method === 'POST' && id === 'confirm-payment') {
          await ensureBrandPaymentSchema();

          const {
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          } = req.body || {};

          if (!orderId || !paymentId || !signature) {
            return bad(res, 'Order ID and Razorpay payment fields are required');
          }

          const signatureValid = await verifySignature(String(orderId), String(paymentId), String(signature));
          if (!signatureValid) {
            return bad(res, 'Payment signature verification failed');
          }

          const result = await transaction(async (tx) => {
            // Check if payment already processed
            const paymentExisting = await tx(
              'SELECT * FROM brand_registrations WHERE payment_ref = $1 LIMIT 1',
              [paymentId]
            );
            if (paymentExisting.rows.length > 0) {
              return paymentExisting.rows[0];
            }

            // Get pending registration
            const pending = await tx(
              `SELECT * FROM brand_registrations
               WHERE account_id = $1 AND status = 'pending'
               FOR UPDATE
               LIMIT 1`,
              [accountId]
            );

            if (pending.rows.length === 0) {
              throw new Error('No pending brand registration found');
            }

            const reg = pending.rows[0];

            // Update registration with payment details
            const updated = await tx(
              `UPDATE brand_registrations
               SET payment_provider = $1, payment_order_ref = $2, payment_ref = $3,
                   status = 'payment_verified', fee_status = 'collected', updated_at = NOW()
               WHERE id = $4
               RETURNING *`,
              ['razorpay', String(orderId), String(paymentId), reg.id]
            );

            return updated.rows[0];
          });

          const accountRow = await getAccountSummary(accountId);

          return created(res, {
            id: result.id,
            accountId: String(result.account_id),
            registrationFeeCents: result.registration_fee_cents,
            paymentRef: result.payment_ref,
            status: result.status,
            activatedAt: result.activated_at,
            createdAt: result.created_at,
            displayName: accountRow?.display_name,
            message: 'Brand registration payment confirmed. Activation in progress.',
          });
        }

        if (req.method === 'GET' && id === 'status') {
          await ensureBrandPaymentSchema();

          const result = await query(
            `SELECT id, account_id, registration_fee_cents, status, activated_at, payment_ref, currency
             FROM brand_registrations
             WHERE account_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [accountId]
          );

          if (result.rows.length === 0) {
            return ok(res, {
              registered: false,
              status: null,
            });
          }

          const reg = result.rows[0];
          return ok(res, {
            registered: reg.status === 'completed',
            status: reg.status,
            activatedAt: reg.activated_at,
            paymentRef: reg.payment_ref,
            registrationFeeCents: reg.registration_fee_cents,
            currency: reg.currency,
          });
        }

        break;
      }

      default:
        return notFound(res);
    }
  } catch (error: any) {
    console.error('Brand registration API error:', error);
    return serverError(res, error.message || 'Internal server error');
  }
}
