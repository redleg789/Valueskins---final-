import { NextRequest, NextResponse } from 'next/server';
import { archiveOldDeals } from '@/lib/cron-reminders';

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
    await archiveOldDeals();
    return NextResponse.json({ success: true, message: 'Deals archived' });
  } catch (error) {
    console.error('Archive error:', error);
    return NextResponse.json({ error: 'Archiving failed' }, { status: 500 });
  }
}
