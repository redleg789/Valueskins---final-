export const PLATFORM_FEE_PERCENTAGE = 2;
export const DEFAULT_PLATFORM_FEE_PERCENTAGE = PLATFORM_FEE_PERCENTAGE;
export const DEFAULT_PLATFORM_FEE_CENTS = 0;
export const DEFAULT_PAYMENT_CURRENCY = 'INR';

export type PlatformFeeBreakdown = {
  feeCents: number;
  netAmountCents: number;
  grossAmountCents: number;
};

export function calculatePlatformFee(amountCents: number): PlatformFeeBreakdown {
  const grossAmountCents = Math.max(0, Math.round(amountCents));
  const feeCents = Math.round(grossAmountCents * (PLATFORM_FEE_PERCENTAGE / 100));
  const netAmountCents = Math.max(0, grossAmountCents - feeCents);

  return {
    feeCents,
    netAmountCents,
    grossAmountCents,
  };
}
