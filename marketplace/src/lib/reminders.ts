export type ReminderType = 'deal_deadline' | 'payment_due' | 'content_due' | 'counter_offer';

export async function scheduleReminder(
  userId: string,
  dealId: string,
  type: ReminderType,
  reminderDate: Date
) {
  try {
    await fetch('/api/reminders/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dealId, type, reminderDate: reminderDate.toISOString() }),
    });
  } catch (error) {
    console.error('Failed to schedule reminder:', error);
  }
}

export async function getReminders(userId: string) {
  try {
    const res = await fetch(`/api/reminders/${userId}`);
    if (res.ok) return await res.json();
    return [];
  } catch (error) {
    console.error('Failed to get reminders:', error);
    return [];
  }
}
