/*
 * DEAL & ESCROW SYSTEM
 * ──────────────────────────────────────────────────────────────────────────
 * PATENT-RELEVANT: Credential-Gated Escrow with Platform-Aware Pricing
 *
 * This system handles the complete deal lifecycle:
 * 1. Deal Creation (Brand creates campaign)
 * 2. Creator Application (Apply via MIM)
 * 3. Brand Acceptance (Select creator)
 * 4. Escrow Deposit (Brand funds deal)
 * 5. Deliverable Submission (Creator submits work)
 * 6. Approval & Payout (Brand approves, funds release)
 * 7. Dispute Resolution (If issues arise)
 *
 * REVENUE MODEL:
 * - Platform takes 15% commission on all deals
 * - Level-based pricing multipliers (Level 5 = 10x base rate)
 * - Cross-platform deals pay 1.5x premium
 */

import { Platform } from './professions';

export type OpportunityStatus = 'open' | 'closed' | 'in_progress' | 'completed' | 'cancelled';

export type DealStatus =
  | 'draft'           // Brand creating
  | 'active'          // Open for applications
  | 'pending'         // Creator applied, awaiting brand decision
  | 'accepted'        // Brand accepted creator
  | 'funded'          // Escrow deposited
  | 'in_progress'     // Creator working on deliverables
  | 'submitted'       // Creator submitted deliverables
  | 'revision'        // Brand requested revision
  | 'approved'        // Brand approved deliverables
  | 'completed'       // Payment released
  | 'disputed'        // In dispute resolution
  | 'cancelled';      // Deal cancelled

export type DeliverableType =
  | 'post'            // Single feed post
  | 'story'           // Stories/ephemeral content
  | 'reel'            // Short-form video
  | 'video'           // Long-form video
  | 'article'         // LinkedIn article / blog
  | 'review'          // Product review
  | 'mention'         // Brand mention
  | 'custom';         // Custom deliverable

export interface Deliverable {
  id: string;
  type: DeliverableType;
  description: string;
  quantity: number;
  platform: Platform;
  dueDate: Date;
  status: 'pending' | 'submitted' | 'approved' | 'revision_needed';
  submissionUrl?: string;
  submissionNotes?: string;
  feedbackNotes?: string;
}

export interface Deal {
  id: string;
  brandId: string;
  brandName: string;
  brandLogo?: string;
  creatorId?: string;
  creatorName?: string;
  creatorLevel?: number;

  // Campaign details
  title: string;
  description: string;
  category: string;

  // Pricing
  baseBudget: number;           // In cents ($25.00 = 2500)
  levelMultiplier: number;      // 1.0 to 10.0 based on creator level
  platformPremium: number;      // 1.0 or 1.5 for cross-platform
  platformFee: number;          // 15% commission
  totalAmount: number;          // Final amount to creator
  escrowAmount: number;         // Amount held in escrow

  // Requirements
  platforms: Platform[];
  requiredLevel: number;
  deliverables: Deliverable[];

  // Timeline
  applicationDeadline: Date;
  deliveryDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Status
  status: DealStatus;
  applicantCount: number;

  // Contract
  contractId?: string;
  contractSigned?: boolean;

  // Ratings
  brandRating?: number;
  creatorRating?: number;
  brandReview?: string;
  creatorReview?: string;
}

export interface DealApplication {
  id: string;
  dealId: string;
  creatorId: string;
  creatorName: string;
  creatorLevel: number;
  creatorProfession: string;
  pitch: string;
  portfolioLinks: string[];
  proposedRate?: number;
  submittedAt: Date;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface EscrowTransaction {
  id: string;
  dealId: string;
  type: 'deposit' | 'release' | 'refund' | 'partial_release';
  amount: number;
  fromAccount: string;       // brand_id or 'platform'
  toAccount: string;         // creator_id, brand_id, or 'platform'
  status: 'pending' | 'completed' | 'failed';
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface Dispute {
  id: string;
  dealId: string;
  raisedBy: 'brand' | 'creator';
  reason: string;
  description: string;
  evidence: string[];
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  resolution?: string;
  resolvedAt?: Date;
  refundAmount?: number;
}

// ═════════════════════════════════════════════════════════════════════════
// PRICING CALCULATIONS
// ═════════════════════════════════════════════════════════════════════════

export const LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.5,
  4: 5.0,
  5: 10.0,
};

export const PLATFORM_FEE_PERCENT = 0.15; // 15% platform commission
export const CROSS_PLATFORM_PREMIUM = 1.5; // 50% extra for multi-platform deals

export function calculateDealPricing(
  baseBudget: number,        // In cents
  creatorLevel: number,
  isCrossPlatform: boolean
): {
  levelMultiplier: number;
  platformPremium: number;
  platformFee: number;
  creatorPayout: number;
  totalBrandCost: number;
} {
  const levelMultiplier = LEVEL_MULTIPLIERS[creatorLevel] || 1.0;
  const platformPremium = isCrossPlatform ? CROSS_PLATFORM_PREMIUM : 1.0;

  const adjustedBudget = baseBudget * levelMultiplier * platformPremium;
  const platformFee = Math.round(adjustedBudget * PLATFORM_FEE_PERCENT);
  const totalBrandCost = Math.round(adjustedBudget + platformFee);
  const creatorPayout = Math.round(adjustedBudget);

  return {
    levelMultiplier,
    platformPremium,
    platformFee,
    creatorPayout,
    totalBrandCost,
  };
}

export function formatCurrency(cents: number, currencyCode?: string): string {
  const code = currencyCode || 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: code, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${code} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// CURRENCY HELPERS
// ═════════════════════════════════════════════════════════════════════════

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  'United States': 'USD', 'India': 'INR', 'United Kingdom': 'GBP', 'Canada': 'CAD',
  'Australia': 'AUD', 'Japan': 'JPY', 'Germany': 'EUR', 'France': 'EUR', 'Italy': 'EUR',
  'Spain': 'EUR', 'Netherlands': 'EUR', 'Belgium': 'EUR', 'Austria': 'EUR', 'Ireland': 'EUR',
  'Portugal': 'EUR', 'Finland': 'EUR', 'Greece': 'EUR', 'Luxembourg': 'EUR',
  'Brazil': 'BRL', 'Mexico': 'MXN', 'South Korea': 'KRW', 'China': 'CNY',
  'Russia': 'RUB', 'South Africa': 'ZAR', 'Nigeria': 'NGN', 'Kenya': 'KES',
  'Singapore': 'SGD', 'Malaysia': 'MYR', 'Thailand': 'THB', 'Indonesia': 'IDR',
  'Philippines': 'PHP', 'Vietnam': 'VND', 'Pakistan': 'PKR', 'Bangladesh': 'BDT',
  'Turkey': 'TRY', 'Saudi Arabia': 'SAR', 'United Arab Emirates': 'AED',
  'Switzerland': 'CHF', 'Sweden': 'SEK', 'Norway': 'NOK', 'Denmark': 'DKK',
  'Poland': 'PLN', 'Czech Republic': 'CZK', 'Hungary': 'HUF', 'Romania': 'RON',
  'Israel': 'ILS', 'Egypt': 'EGP', 'Argentina': 'ARS', 'Colombia': 'COP',
  'Chile': 'CLP', 'Peru': 'PEN', 'New Zealand': 'NZD', 'Taiwan': 'TWD',
};

export function getCurrencyForCountry(country: string): string {
  return COUNTRY_CURRENCY_MAP[country] || 'USD';
}

// ═════════════════════════════════════════════════════════════════════════
// STATUS HELPERS
// ═════════════════════════════════════════════════════════════════════════

export function getOpportunityStatusInfo(status: OpportunityStatus): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  const statusMap: Record<OpportunityStatus, { label: string; color: string; bgColor: string; description: string }> = {
    open:        { label: 'Open',        color: '#10b981', bgColor: '#10b98120', description: 'Accepting applications' },
    closed:      { label: 'Closed',      color: '#737373', bgColor: '#26262620', description: 'No longer accepting applications' },
    in_progress: { label: 'In Progress', color: '#0095f6', bgColor: '#0095f620', description: 'Work underway' },
    completed:   { label: 'Completed',   color: '#10b981', bgColor: '#10b98120', description: 'Campaign complete' },
    cancelled:   { label: 'Cancelled',   color: '#ef4444', bgColor: '#ef444420', description: 'Campaign cancelled' },
  };
  return statusMap[status];
}

export function getDealStatusInfo(status: DealStatus): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  const statusMap: Record<DealStatus, { label: string; color: string; bgColor: string; description: string }> = {
    draft: { label: 'Draft', color: '#737373', bgColor: '#26262620', description: 'Campaign is being created' },
    active: { label: 'Open', color: '#10b981', bgColor: '#10b98120', description: 'Accepting applications' },
    pending: { label: 'Applied', color: '#f59e0b', bgColor: '#f59e0b20', description: 'Awaiting brand decision' },
    accepted: { label: 'Accepted', color: '#0095f6', bgColor: '#0095f620', description: 'You\'ve been selected!' },
    funded: { label: 'Funded', color: '#8b5cf6', bgColor: '#8b5cf620', description: 'Payment in escrow' },
    in_progress: { label: 'In Progress', color: '#0095f6', bgColor: '#0095f620', description: 'Working on deliverables' },
    submitted: { label: 'Submitted', color: '#f59e0b', bgColor: '#f59e0b20', description: 'Awaiting brand approval' },
    revision: { label: 'Revision', color: '#ef4444', bgColor: '#ef444420', description: 'Changes requested' },
    approved: { label: 'Approved', color: '#10b981', bgColor: '#10b98120', description: 'Deliverables approved' },
    completed: { label: 'Completed', color: '#10b981', bgColor: '#10b98120', description: 'Payment released' },
    disputed: { label: 'Disputed', color: '#ef4444', bgColor: '#ef444420', description: 'In dispute resolution' },
    cancelled: { label: 'Cancelled', color: '#737373', bgColor: '#26262620', description: 'Deal was cancelled' },
  };

  return statusMap[status];
}
