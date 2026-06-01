import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { query } from '@/lib/db-pool';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId } = req.query;
    if (!dealId) return res.status(400).json({ error: 'Deal ID required' });

    const dealResult = await query('SELECT * FROM deals WHERE id = $1', [dealId]);
    if (!dealResult.rows[0]) return res.status(404).json({ error: 'Deal not found' });

    const deal = dealResult.rows[0];
    const startDate = new Date(deal.created_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const deadlineDate = deal.deadline ? new Date(deal.deadline).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : startDate;

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ValueSkins//Deal Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${deal.title} (ValueSkins Deal)
X-WR-TIMEZONE:UTC
BEGIN:VEVENT
DTSTART:${startDate}
DTEND:${deadlineDate}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
UID:${dealId}@valueskins.com
CREATED:${startDate}
DESCRIPTION:ValueSkins Deal: ${deal.title}\\nAll communications are documented for dispute resolution.
LAST-MODIFIED:${startDate}
LOCATION:ValueSkins Marketplace
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:${deal.title}
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="valueskins_${dealId}.ics"`);
    return res.status(200).send(ics);
  } catch (error) {
    console.error('Calendar export error:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
}

export default withApiHandler(handler);
