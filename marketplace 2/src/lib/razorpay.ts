import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export { razorpay };

export interface CreateOrderParams {
  amount: number; // in paise
  currency?: string;
  receipt?: string;
  customer_notify?: 0 | 1;
  notes?: Record<string, any>;
}

export interface CreatePayoutParams {
  account_number: string;
  fund_account_id?: string;
  amount: number; // in paise
  currency?: string;
  mode: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI';
  purpose: 'payout' | 'refund' | 'settlement';
  receipt?: string;
  reference_id?: string;
  notes?: Record<string, any>;
}

export async function createOrder(params: CreateOrderParams) {
  try {
    const order = await razorpay.orders.create(params as any);
    return { success: true, data: order };
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return { success: false, error };
  }
}

export async function fetchOrder(orderId: string) {
  try {
    const order = await razorpay.orders.fetch(orderId);
    return { success: true, data: order };
  } catch (error) {
    console.error('Razorpay order fetch failed:', error);
    return { success: false, error };
  }
}

export async function createTransfer(orderId: string, transfers: any[]) {
  try {
    const result = await ((razorpay as any).orders.createTransfer as any)(orderId, transfers);
    return { success: true, data: result };
  } catch (error) {
    console.error('Razorpay transfer creation failed:', error);
    return { success: false, error };
  }
}

export async function createPayout(params: CreatePayoutParams) {
  try {
    const payout = await ((razorpay as any).payouts.create as any)(params);
    return { success: true, data: payout };
  } catch (error) {
    console.error('Razorpay payout creation failed:', error);
    return { success: false, error };
  }
}

export async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expectedSignature === signature;
}
