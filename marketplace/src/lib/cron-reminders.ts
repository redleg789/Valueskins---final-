import { query } from './db-pool';

export async function processPendingReminders() {
  try {
    const now = new Date();
    
    const reminders = await query(
      `SELECT r.*, d.creator_id, d.brand_id, d.title 
       FROM deal_reminders r
       JOIN deals d ON r.deal_id = d.id
       WHERE r.reminder_date <= $1 AND r.sent_at IS NULL
       ORDER BY r.reminder_date ASC`,
      [now]
    );

    for (const reminder of reminders.rows) {
      try {
        const userId = reminder.type === 'creator' ? reminder.creator_id : reminder.brand_id;
        
        let title = '';
        let message = '';

        if (reminder.type === 'deal_deadline') {
          title = 'Deal Deadline Approaching';
          message = `Deadline for "${reminder.title}" is approaching`;
        } else if (reminder.type === 'payment_due') {
          title = 'Payment Due';
          message = `Payment for "${reminder.title}" is due`;
        } else if (reminder.type === 'content_due') {
          title = 'Content Delivery Due';
          message = `Content for "${reminder.title}" is due`;
        } else if (reminder.type === 'counter_offer') {
          title = 'Counter Offer';
          message = `Counter offer on "${reminder.title}"`;
        }

        await query(
          `INSERT INTO notifications (user_id, title, message, type, created_at)
           VALUES ($1, $2, $3, 'reminder', NOW())`,
          [userId, title, message]
        );

        await query(
          'UPDATE deal_reminders SET sent_at = NOW() WHERE id = $1',
          [reminder.id]
        );

        console.log(`Reminder sent for deal ${reminder.deal_id}`);
      } catch (err) {
        console.error(`Failed to process reminder ${reminder.id}:`, err);
      }
    }

    console.log(`Processed ${reminders.rows.length} reminders`);
  } catch (error) {
    console.error('Cron reminders error:', error);
  }
}

export async function archiveOldDeals() {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    await query(
      'UPDATE deals SET archived = TRUE WHERE completed_at < $1 AND archived = FALSE',
      [ninetyDaysAgo]
    );

    console.log('Archived old deals');
  } catch (error) {
    console.error('Archive error:', error);
  }
}
