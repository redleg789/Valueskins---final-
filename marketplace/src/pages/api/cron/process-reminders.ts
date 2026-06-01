import { NextRequest, NextResponse } from 'next/server';
import { processPendingReminders } from '@/lib/cron-reminders';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await processPendingReminders();
    return NextResponse.json({ success: true, message: 'Reminders processed' });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
