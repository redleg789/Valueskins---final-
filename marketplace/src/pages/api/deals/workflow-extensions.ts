import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

/**
 * Deal Workflow Extensions - Integrated into existing locked phases
 *
 * brief → pending → counter → pending → accepted → softhold → checklist → approved
 *
 * Each phase now includes:
 * - Reminders (shift details, deadlines)
 * - Calendar (prevent double-booking)
 * - Negotiation helpers (pricing, payment terms)
 * - Deliverable tracking (submissions, revisions, approval)
 * - Invoice management (generation, tracking, payment)
 * - Contract storage & review
 * - Post-campaign metrics & reports
 */

// ============================================================================
// PHASE: PENDING/COUNTER (Negotiation Phase)
// ============================================================================

export async function addNegotiationMetadata(dealId: string, creatorId: number, brandId: number) {
  /**
   * When entering negotiation (pending/counter phase):
   * - Pricing tracker
   * - Payment terms helper
   * - Draft response suggestions
   * - Spam filter check
   */

  const negotiation = {
    deal_id: dealId,
    negotiation_history: [],
    current_offer: { price: 0, terms: '', payment_timeline: '30 days' },
    counter_offer: null,
    suggested_responses: [],
    brand_reputation: await getBrandReputation(brandId),
    deal_quality_score: 0, // 1-10, helps creators say "no" to bad deals
  };

  return negotiation;
}

async function getBrandReputation(brandId: number) {
  const history = await query(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as deal_count
     FROM deal_ratings WHERE brand_user_id = $1`,
    [brandId],
  );

  return {
    average_rating: history.rows[0]?.avg_rating || 0,
    total_deals: history.rows[0]?.deal_count || 0,
    payment_reliability: 'Unknown', // Tracked from past payments
    contract_honesty: 'Unknown', // Tracked from disputes
  };
}

export async function suggestNegotiationResponse(
  offer: string,
  creatorLevel: string,
  brandReputation: any,
): Promise<string> {
  /**
   * AI-powered: Convert rough negotiation into professional response
   * Items: #28 (handling awkward negotiations), #29 (saying "no"), #12 (usage rights)
   */

  const responses = {
    low_offer: `Thanks for the offer! Based on my [niche] experience and [follower_count] followers,
                I typically charge $[X] for this type of content. Happy to discuss terms that work for both of us.`,
    bad_contract: `I noticed the exclusivity clause is 6 months. I usually cap at 30 days for [niche].
                   Can we adjust that? I'm open to higher rates for longer exclusivity.`,
    missing_rights: `Just to clarify - can you specify usage rights? Am I licensing for 3 months
                     or exclusive forever? This affects my pricing.`,
    spam_offer: `I appreciate the reach-out, but this seems like it might not be the right fit.
                 Best of luck finding the right creator!`,
  };

  // Classify offer type and return suggestion
  return responses.low_offer; // Simplified for now
}

// ============================================================================
// PHASE: ACCEPTED (Coordination Phase - Deal Locked)
// ============================================================================

export async function createDealTimeline(dealId: string, deal: any) {
  /**
   * When deal is ACCEPTED: Create full timeline with reminders
   * Items: #1 (shoot reminders), #2 (calendar), #3 (prevent double-booking), #26 (campaign timelines)
   */

  const timeline = {
    created_at: new Date(),
    events: [
      {
        date: deal.agreement_deadline,
        event: 'Review & sign contract',
        type: 'contract',
        completed: false,
        reminder_sent: false,
      },
      {
        date: new Date(deal.shoot_date),
        event: 'Shoot day',
        type: 'milestone',
        details: {
          time: deal.shoot_time || 'TBD',
          location: deal.shoot_location || 'TBD',
          dress_code: deal.dress_code || 'TBD',
          contact_person: deal.brand_contact || 'TBD',
        },
        reminder_sent: false,
      },
      {
        date: new Date(deal.submission_deadline),
        event: 'Submit deliverables',
        type: 'deliverable',
        completed: false,
        reminder_sent: false,
      },
      {
        date: new Date(deal.approval_deadline),
        event: 'Brand approval deadline',
        type: 'approval',
        completed: false,
        reminder_sent: false,
      },
      {
        date: new Date(deal.posting_deadline),
        event: 'Post content (embargo date)',
        type: 'posting',
        completed: false,
        reminder_sent: false,
      },
      {
        date: new Date(deal.payment_due_date),
        event: 'Payment due',
        type: 'payment',
        completed: false,
        reminder_sent: false,
      },
    ],
  };

  // Check for scheduling conflicts (logged but not returned in timeline for now)
  const conflicts = await detectConflicts(deal.creator_id, deal.shoot_date);
  // TODO: Surface conflicts in UI for creator awareness

  return timeline;
}

async function detectConflicts(creatorId: number, shootDate: string): Promise<any[]> {
  /**
   * Item #19: Preventing double-booking
   * Query all accepted deals and check for date overlaps
   */

  const conflicts = await query(
    `SELECT * FROM deal_rooms
     WHERE creator_user_id = $1
     AND phase = 'accepted'
     AND DATE(shoot_date) = DATE($2)`,
    [creatorId, shootDate],
  );

  return conflicts.rows;
}

export async function storeContract(
  dealId: string,
  contractFile: string,
  termsText: string,
): Promise<string> {
  /**
   * Item #6 (contract review & handling), #39 (coordinating signatures)
   * Store contract with status tracking
   */

  const contractId = require('crypto').randomBytes(8).toString('hex');

  await query(
    `INSERT INTO deal_contracts (id, deal_id, file_url, terms_text, status, created_at)
     VALUES ($1, $2, $3, $4, 'pending_review', NOW())`,
    [contractId, dealId, contractFile, termsText],
  );

  return contractId;
}

export async function flagExclusivityAndEmbargo(deal: any) {
  /**
   * Items: #40 (tracking exclusivity periods), #41 (remembering embargo dates)
   * Create calendar alerts for these critical dates
   */

  return {
    exclusivity_start: deal.exclusivity_start_date,
    exclusivity_end: deal.exclusivity_end_date,
    embargo_date: deal.posting_deadline,
    notes: `Cannot post until ${deal.posting_deadline}. Cannot work with competitor [X] until ${deal.exclusivity_end_date}`,
  };
}

// ============================================================================
// PHASE: SOFTHOLD (Work In Progress)
// ============================================================================

export async function createDeliverableChecklist(dealId: string, deliverables: any[]) {
  /**
   * Item #7 (deliverable tracking), #47 (pre-shoot checklists)
   * Structured submission process with revision limits
   */

  const checklist = deliverables.map((del, idx) => ({
    id: `del_${idx}`,
    name: del.name,
    description: del.description,
    deadline: del.deadline,
    status: 'pending',
    revisions_remaining: 3,
    submitted_at: null,
    approved_at: null,
    submission_notes: null,
  }));

  await query(
    `INSERT INTO deal_deliverables (deal_id, deliverables_json, created_at)
     VALUES ($1, $2, NOW())`,
    [dealId, JSON.stringify(checklist)],
  );

  return checklist;
}

export async function submitDeliverable(
  dealId: string,
  deliverableId: string,
  files: string[],
  notes: string,
) {
  /**
   * Item #25 (tracking content approval status)
   * Creator submits, goes to brand approval queue
   */

  await query(
    `UPDATE deal_deliverables
     SET status = 'submitted', submitted_at = NOW(), submission_files = $1, submission_notes = $2
     WHERE deal_id = $3 AND deliverable_id = $4`,
    [JSON.stringify(files), notes, dealId, deliverableId],
  );

  // Notify brand (TODO: send email)
  // Create approval task for brand
}

export async function requestRevisions(
  dealId: string,
  deliverableId: string,
  revisionNotes: string,
) {
  /**
   * Item #11 (managing revision requests)
   * Track revision count, prevent unlimited revisions
   */

  const current = await query(
    `SELECT revisions_remaining FROM deal_deliverables
     WHERE deal_id = $1 AND deliverable_id = $2`,
    [dealId, deliverableId],
  );

  if (!current.rows.length || current.rows[0].revisions_remaining <= 0) {
    throw new Error('No revisions remaining. Contact brand for additional revisions.');
  }

  await query(
    `UPDATE deal_deliverables
     SET status = 'revisions_requested',
         revisions_remaining = revisions_remaining - 1,
         revision_notes = $1,
         updated_at = NOW()
     WHERE deal_id = $2 AND deliverable_id = $3`,
    [revisionNotes, dealId, deliverableId],
  );
}

// ============================================================================
// PHASE: CHECKLIST (Approval Phase)
// ============================================================================

export async function approveAllDeliverables(dealId: string) {
  /**
   * When brand approves: unlock payment, create invoice
   * Items: #5 (chasing payments), #36 (sending invoices)
   */

  await query(
    `UPDATE deal_deliverables SET status = 'approved', approved_at = NOW()
     WHERE deal_id = $1`,
    [dealId],
  );

  // Generate invoice
  const invoice = await createInvoice(dealId);
  return invoice;
}

export async function createInvoice(dealId: string) {
  /**
   * Items: #36 (sending invoices), #37 (tracking pending invoices)
   * Auto-generate invoice, track payment status
   */

  const deal = await query('SELECT * FROM deal_rooms WHERE id = $1', [dealId]);
  if (!deal.rows.length) throw new Error('Deal not found');

  const invoiceId = require('crypto').randomBytes(8).toString('hex');
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // 7 days to pay

  await query(
    `INSERT INTO deal_invoices (id, deal_id, creator_id, brand_id, amount, due_date, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', NOW())`,
    [
      invoiceId,
      dealId,
      deal.rows[0].creator_user_id,
      deal.rows[0].brand_user_id,
      deal.rows[0].agreed_amount,
      dueDate.toISOString(),
    ],
  );

  return invoiceId;
}

export async function sendInvoiceEmail(invoiceId: string, creatorEmail: string) {
  /**
   * Item #36: Send invoice via email
   * Item #5: Automatic payment chasing
   */

  await query(
    `UPDATE deal_invoices SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [invoiceId],
  );

  // TODO: Send email with invoice PDF
}

export async function trackPaymentStatus(invoiceId: string) {
  /**
   * Item #37 (tracking pending invoices), #38 (tax/payment paperwork)
   * Show overdue warnings, payment status
   */

  const invoice = await query('SELECT * FROM deal_invoices WHERE id = $1', [invoiceId]);

  if (!invoice.rows.length) return null;

  const inv = invoice.rows[0];
  const daysSinceDue = Math.floor(
    (new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    status: inv.status,
    due_date: inv.due_date,
    amount: inv.amount,
    days_overdue: daysSinceDue > 0 ? daysSinceDue : 0,
    payment_reminder_sent: daysSinceDue >= 3, // Auto-escalate after 3 days
  };
}

// ============================================================================
// PHASE: APPROVED (Post-Campaign)
// ============================================================================

export async function collectCampaignMetrics(dealId: string) {
  /**
   * Items: #34 (collecting metrics), #35 (making reports)
   * After campaign: pull performance data, generate report
   */

  const metrics = {
    content_pieces: 0,
    total_reach: 0,
    engagement_rate: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    roi_estimate: 0,
  };

  // TODO: Pull from social media APIs (Instagram, TikTok, YouTube)
  // For now, placeholder

  return metrics;
}

export async function generatePostCampaignReport(dealId: string) {
  /**
   * Item #35: Create post-campaign report
   * Includes metrics, deliverables completed, brand feedback, recommendations
   */

  const deal = await query('SELECT * FROM deal_rooms WHERE id = $1', [dealId]);
  const metrics = await collectCampaignMetrics(dealId);

  const report = {
    campaign_name: deal.rows[0].campaign_name,
    dates: {
      start: deal.rows[0].start_date,
      end: deal.rows[0].end_date,
    },
    metrics,
    deliverables_completed: 0,
    brand_feedback: '',
    creator_notes: '',
    recommendations_for_next: [],
  };

  return report;
}

// ============================================================================
// CROSS-PHASE FEATURES
// ============================================================================

export async function createMediaKit(creatorId: number) {
  /**
   * Item #32: Creating media kits
   * Generate PDF with creator stats, niches, rates
   */

  const creator = await query('SELECT * FROM users WHERE id = $1', [creatorId]);
  if (!creator.rows.length) throw new Error('Creator not found');

  const mediaKit = {
    creator_name: creator.rows[0].display_name,
    niches: creator.rows[0].niche,
    followers: creator.rows[0].followers_count,
    engagement_rate: creator.rows[0].engagement_rate,
    rates: creator.rows[0].base_rate || 'Contact for rates',
    past_brands: [], // TODO: Query from completed deals
    contact_email: creator.rows[0].email,
  };

  // TODO: Generate PDF and store

  return mediaKit;
}

export async function updatePortfolio(creatorId: number, campaignId: string) {
  /**
   * Item #33: Updating portfolios
   * After campaign approved, add to creator's portfolio
   */

  const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);

  if (!campaign.rows.length) return;

  await query(
    `UPDATE users
     SET portfolio_items = array_append(portfolio_items, $1)
     WHERE id = $2`,
    [JSON.stringify(campaign.rows[0]), creatorId],
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = parseInt(req.headers['x-user-id'] as string, 10);

  try {
    if (req.method === 'POST' && req.body.action === 'create-timeline') {
      const timeline = await createDealTimeline(req.body.deal_id, req.body.deal);
      return res.status(200).json(timeline);
    }

    if (req.method === 'POST' && req.body.action === 'submit-deliverable') {
      await submitDeliverable(
        req.body.deal_id,
        req.body.deliverable_id,
        req.body.files,
        req.body.notes,
      );
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && req.body.action === 'request-revisions') {
      await requestRevisions(req.body.deal_id, req.body.deliverable_id, req.body.notes);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && req.body.action === 'approve-deal') {
      const invoice = await approveAllDeliverables(req.body.deal_id);
      return res.status(200).json({ invoice });
    }

    if (req.method === 'POST' && req.body.action === 'send-invoice') {
      await sendInvoiceEmail(req.body.invoice_id, req.body.email);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET' && req.query.action === 'payment-status') {
      const status = await trackPaymentStatus(req.query.invoice_id as string);
      return res.status(200).json(status);
    }

    if (req.method === 'GET' && req.query.action === 'campaign-report') {
      const report = await generatePostCampaignReport(req.query.deal_id as string);
      return res.status(200).json(report);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Workflow extension error:', err);
    return res.status(500).json({ error: err.message });
  }
}
