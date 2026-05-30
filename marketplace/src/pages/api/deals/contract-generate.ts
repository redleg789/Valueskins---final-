import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

const sanitizeHtml = (text: string): string => {
  return (text || '').replace(/[<>]/g, '').slice(0, 1000);
};

const formatCurrency = (amount: number): string => {
  if (typeof amount !== 'number' || amount < 0) return '$0.00';
  return `$${amount.toFixed(2)}`;
};

const formatDate = (dateStr: any): string => {
  if (!dateStr) return 'TBD';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return 'TBD';
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader || typeof userIdHeader !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = parseInt(userIdHeader, 10);
    if (isNaN(userId)) {
      return res.status(401).json({ error: 'Invalid user ID' });
    }

    const { dealId } = req.body;
    if (!dealId || typeof dealId !== 'number') {
      return res.status(400).json({ error: 'Invalid dealId' });
    }

    // Verify user is authorized (brand or creator on deal)
    const dealResult = await query(
      `SELECT d.id, d.brand_id, d.creator_id, d.offer_amount, d.deal_state, d.submission_deadline, d.posting_deadline,
              b.display_name as brand_name, c.display_name as creator_name
       FROM deals d
       JOIN accounts b ON d.brand_id = b.id
       JOIN users c ON d.creator_id = c.id
       WHERE d.id = $1 AND (d.brand_id = (SELECT account_id FROM users WHERE id = $2) OR d.creator_id = $2)`,
      [dealId, userId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found or unauthorized' });
    }

    const deal = dealResult.rows[0];

    // Only generate contract if deal is accepted or later
    if (!['accepted', 'softhold', 'checklist', 'approved'].includes(deal.deal_state)) {
      return res.status(400).json({ error: 'Contract can only be generated for accepted or later deals' });
    }

    // Generate contract HTML (sanitized)
    const brandName = sanitizeHtml(deal.brand_name);
    const creatorName = sanitizeHtml(deal.creator_name);
    const offerAmount = formatCurrency(deal.offer_amount);
    const submissionDeadline = formatDate(deal.submission_deadline);
    const postingDeadline = formatDate(deal.posting_deadline);
    const agreementDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const contractHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .section { margin: 20px 0; }
    .section h2 { font-size: 16px; font-weight: bold; margin: 10px 0 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .term-label { font-weight: bold; width: 30%; }
    .signature { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-box { width: 45%; border-top: 1px solid #000; padding-top: 10px; text-align: center; }
    p { line-height: 1.8; }
  </style>
</head>
<body>
  <h1>Content Collaboration Agreement</h1>

  <div class="section">
    <h2>Parties</h2>
    <table>
      <tr>
        <td class="term-label">Brand:</td>
        <td>${brandName}</td>
      </tr>
      <tr>
        <td class="term-label">Creator:</td>
        <td>${creatorName}</td>
      </tr>
      <tr>
        <td class="term-label">Agreement Date:</td>
        <td>${agreementDate}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Deal Terms</h2>
    <table>
      <tr>
        <td class="term-label">Deal Value:</td>
        <td>${offerAmount}</td>
      </tr>
      <tr>
        <td class="term-label">Submission Deadline:</td>
        <td>${submissionDeadline}</td>
      </tr>
      <tr>
        <td class="term-label">Posting Date:</td>
        <td>${postingDeadline}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Payment Terms</h2>
    <table>
      <tr>
        <td class="term-label">Total Payment:</td>
        <td>${offerAmount}</td>
      </tr>
      <tr>
        <td class="term-label">Payment Structure:</td>
        <td>50% upfront, 50% on deliverable approval</td>
      </tr>
      <tr>
        <td class="term-label">Payment Due:</td>
        <td>7 days after creator approval of final deliverables</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Rights & Usage</h2>
    <p>Creator grants Brand a non-exclusive license to use the created content for the campaign specified above. Creator retains ownership of the original work. Brand may use content for 12 months from posting date. After 12 months, content may be archived but not actively promoted without additional compensation.</p>
  </div>

  <div class="section">
    <h2>Revisions</h2>
    <p>Brand may request up to 2 rounds of revisions without additional cost. Additional revisions beyond 2 will be charged separately. Creator has 3 business days to deliver revisions.</p>
  </div>

  <div class="section">
    <h2>Dispute Resolution</h2>
    <p>Any disputes arising from this agreement will be resolved through ValueSkins arbitration system. Both parties agree to binding arbitration before legal action.</p>
  </div>

  <div class="signature">
    <div class="sig-box">
      <p>Brand Representative</p>
      <p>_____________________</p>
      <p>Date: _____________________</p>
    </div>
    <div class="sig-box">
      <p>Creator</p>
      <p>_____________________</p>
      <p>Date: _____________________</p>
    </div>
  </div>

  <p style="font-size: 10px; color: #666; margin-top: 40px; text-align: center;">This contract was auto-generated by ValueSkins. For legal questions, consult an attorney.</p>
</body>
</html>`;

    // Ensure column exists
    await query(
      `ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_html TEXT,
       ADD COLUMN IF NOT EXISTS contract_generated_at TIMESTAMPTZ`
    ).catch(() => {});

    // Store contract in database
    await query(
      'UPDATE deals SET contract_html = $1, contract_generated_at = NOW() WHERE id = $2',
      [contractHTML, dealId]
    );

    return res.status(200).json({
      success: true,
      contractGenerated: true,
      dealId,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[contract-generate] Error:', {
      method: req.method,
      dealId: req.body?.dealId,
      userId: req.headers['x-user-id'],
      message: err.message,
      code: err.code,
    });
    return res.status(500).json({ error: 'Failed to generate contract' });
  }
}
