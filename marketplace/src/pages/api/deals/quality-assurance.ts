import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

const validateQAInput = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.dealId || typeof data.dealId !== 'number') {
    errors.push('dealId must be a valid number');
  }
  if (!['approve', 'request_changes'].includes(data.action)) {
    errors.push('action must be "approve" or "request_changes"');
  }
  if (data.action === 'request_changes') {
    if (!Array.isArray(data.issues) || data.issues.some((i: any) => typeof i !== 'string')) {
      errors.push('issues must be array of strings');
    }
    if (!data.notes || typeof data.notes !== 'string' || data.notes.length > 1000) {
      errors.push('notes must be non-empty string (max 1000 chars)');
    }
  }

  return { valid: errors.length === 0, errors };
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

    const { dealId, action, issues, notes } = req.body;

    // Validate input
    const validation = validateQAInput({ dealId, action, issues, notes });
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    // Verify deal exists and user is brand on this deal
    const dealCheck = await query(
      `SELECT d.id, d.deal_state, d.creator_id FROM deals d
       WHERE d.id = $1 AND d.brand_id = (SELECT account_id FROM users WHERE id = $2)`,
      [dealId, userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found or unauthorized' });
    }

    const deal = dealCheck.rows[0];

    // QA can only happen in CHECKLIST phase
    if (deal.deal_state !== 'checklist') {
      return res.status(400).json({ error: `QA can only be performed in checklist phase, current: ${deal.deal_state}` });
    }

    // Ensure columns exist
    await query(`
      ALTER TABLE deals ADD COLUMN IF NOT EXISTS qa_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS qa_issues JSONB,
      ADD COLUMN IF NOT EXISTS qa_notes TEXT,
      ADD COLUMN IF NOT EXISTS qa_reviewed_at TIMESTAMPTZ
    `).catch(() => {});

    if (action === 'approve') {
      await query(
        `UPDATE deals SET qa_status = 'approved', qa_reviewed_at = NOW(), qa_issues = $1 WHERE id = $2`,
        [JSON.stringify([]), dealId]
      );

      return res.status(200).json({
        success: true,
        message: 'QA approved - content approved for posting',
        dealId,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'request_changes') {
      const issuesJson = JSON.stringify(Array.isArray(issues) ? issues : []);
      const notesText = notes ? notes.slice(0, 1000) : '';

      await query(
        `UPDATE deals SET qa_status = 'changes_requested', qa_reviewed_at = NOW(), qa_issues = $1, qa_notes = $2 WHERE id = $3`,
        [issuesJson, notesText, dealId]
      );

      return res.status(200).json({
        success: true,
        message: 'QA changes requested',
        dealId,
        issuesCount: Array.isArray(issues) ? issues.length : 0,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err: any) {
    console.error('[quality-assurance] Error:', {
      method: req.method,
      dealId: req.body?.dealId,
      action: req.body?.action,
      userId: req.headers['x-user-id'],
      message: err.message,
      code: err.code,
    });
    return res.status(500).json({ error: 'Failed to process QA review' });
  }
}
