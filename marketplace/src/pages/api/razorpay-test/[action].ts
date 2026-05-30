import type { NextApiRequest, NextApiResponse } from 'next';
import { createOrder, verifySignature } from '@/lib/razorpay';
import { getBusinessBankConfig } from '@/lib/businessBank';
import { calculatePlatformFee, DEFAULT_PAYMENT_CURRENCY } from '@/lib/platformFees';

function keyId() {
  return process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
}

function hasServerKeys() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;
  const route = Array.isArray(action) ? action[0] : action;

  if (route === 'config' && req.method === 'GET') {
    const businessBank = getBusinessBankConfig();
    return res.status(200).json({
      keyId: keyId(),
      hasKeyId: Boolean(keyId()),
      hasKeySecret: Boolean(process.env.RAZORPAY_KEY_SECRET),
      readyForOrders: hasServerKeys(),
      mode: keyId().startsWith('rzp_test_') ? 'test' : 'unknown',
      businessBank: {
        label: businessBank.label,
        bankName: businessBank.bankName,
        accountHolderName: businessBank.accountHolderName,
        accountNumberLast4: businessBank.accountNumber.slice(-4),
        ifsc: businessBank.ifsc,
      },
    });
  }

  if (route === 'business-bank' && req.method === 'GET') {
    const bank = getBusinessBankConfig();
    return res.status(200).json({
      ...bank,
      accountNumberMasked: `${'*'.repeat(Math.max(bank.accountNumber.length - 4, 0))}${bank.accountNumber.slice(-4)}`,
    });
  }

  if (route === 'create-order' && req.method === 'POST') {
    if (!hasServerKeys()) {
      return res.status(400).json({
        error: 'Missing Razorpay server credentials. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to marketplace/.env.local',
      });
    }

    const amountInput = Number(req.body?.amountInRupees || 0);
    if (!Number.isFinite(amountInput) || amountInput <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount in rupees' });
    }

    const amount = Math.round(amountInput * 100);
    const fee = calculatePlatformFee(amount);
    const businessBank = getBusinessBankConfig();
    const receipt = `vs_test_${Date.now()}`;
    const order = await createOrder({
      amount,
      currency: DEFAULT_PAYMENT_CURRENCY,
      receipt,
      notes: {
        source: 'valueskins_razorpay_test',
        platform_fee_cents: String(fee.feeCents),
        net_amount_cents: String(fee.netAmountCents),
        settlement_account_label: businessBank.label,
      },
    });

    if (!order.success) {
      return res.status(500).json({ error: 'Failed to create Razorpay order', detail: order.error });
    }

    return res.status(200).json({
      keyId: keyId(),
      order: order.data,
      fee,
    });
  }

  if (route === 'verify' && req.method === 'POST') {
    const orderId = String(req.body?.razorpay_order_id || '');
    const paymentId = String(req.body?.razorpay_payment_id || '');
    const signature = String(req.body?.razorpay_signature || '');

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const valid = await verifySignature(orderId, paymentId, signature);
    return res.status(200).json({ verified: valid });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
