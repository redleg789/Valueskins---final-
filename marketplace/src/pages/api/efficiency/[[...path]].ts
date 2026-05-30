import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

type Data = Record<string, any>;

const MOCK_ACCOUNT_ID = 'dev-user-001';
const MOCK_PROFILE_ID = 'dev-profile-001';

function id(): string { return Math.random().toString(36).substring(2, 11); }
function now(): string { return new Date().toISOString(); }
function later(h: number): string { return new Date(Date.now() + h * 3600000).toISOString(); }
function escIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function fmtUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function safeDate(dateStr?: string | null, timeStr?: string | null) {
  if (!dateStr) return null;
  const iso = `${dateStr}T${timeStr || '00:00'}:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
async function getEventCalendarPayload(eventId: string) {
  const parsedId = Number(eventId);
  if (Number.isNaN(parsedId)) return null;
  const result = await query(
    `SELECT id, title, one_line_summary, venue_name, full_address, start_time, end_time, timezone
     FROM events
     WHERE id = $1`,
    [parsedId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const start = row.start_time ? new Date(row.start_time) : null;
  const end = row.end_time ? new Date(row.end_time) : (start ? new Date(start.getTime() + 2 * 3600000) : null);
  if (!start || !end) return null;
  const summary = row.title || `Event ${eventId}`;
  const description = row.one_line_summary || 'ValueSkins event';
  const location = [row.venue_name, row.full_address].filter(Boolean).join(', ');
  const uid = `valueskins-event-${eventId}@valueskins.app`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ValueSkins//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${escIcs(summary)}`,
    `DESCRIPTION:${escIcs(description)}`,
    `LOCATION:${escIcs(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return { eventId, summary, description, location, start, end, ics };
}
function buildCalendarLinks(payload: NonNullable<Awaited<ReturnType<typeof getEventCalendarPayload>>>) {
  const dates = `${fmtUtc(payload.start)}/${fmtUtc(payload.end)}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(payload.summary)}&dates=${encodeURIComponent(dates)}&details=${encodeURIComponent(payload.description)}&location=${encodeURIComponent(payload.location)}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(payload.summary)}&body=${encodeURIComponent(payload.description)}&startdt=${encodeURIComponent(payload.start.toISOString())}&enddt=${encodeURIComponent(payload.end.toISOString())}&location=${encodeURIComponent(payload.location)}`;
  const apple = `data:text/calendar;charset=utf-8,${encodeURIComponent(payload.ics)}`;
  return { google, outlook, apple, icsDownload: `/api/efficiency/calendar/ics/${payload.eventId}` };
}

const STORE: Record<string, any[]> = {
  verificationRequests: [],
  waitlistQueue: [],
  fraudScores: [],
  fraudEvents: [],
  reminders: [],
  supportTickets: [],
  supportMessages: [],
  tableSections: [],
  supportKnowledgeBase: [],
  tableReservations: [],
};

function respond(res: NextApiResponse<Data>, status: number, data: Data) {
  return res.status(status).json(data);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const { path } = req.query;
  const segments = Array.isArray(path) ? path : [];
  const route = segments.join('/');

  try {
    // ── VERIFIED HOST ─────────────────────────────────────
    if (route === 'verify/request' && req.method === 'POST') {
      const r = { id: id(), ...req.body, status: 'pending', requesterId: MOCK_ACCOUNT_ID, documents: req.body.documents || [], notes: '', reviewedBy: null, reviewedAt: null, reviewed: false, verifiedAt: null, expiresAt: null, createdAt: now(), updatedAt: now() };
      STORE.verificationRequests.push(r);
      return respond(res, 200, { request: r });
    }

    if (route.startsWith('verify/status/')) {
      const reqId = segments[2];
      const r = STORE.verificationRequests.find(v => v.id === reqId);
      return respond(res, r ? 200 : 404, r ? { request: r } : { error: 'Not found' });
    }

    if (route === 'verify/pending' && req.method === 'GET') {
      return respond(res, 200, { requests: STORE.verificationRequests.filter(v => v.status === 'pending' || v.status === 'under_review') });
    }

    if (route.startsWith('verify/review/') && req.method === 'POST') {
      const reqId = segments[2];
      const r = STORE.verificationRequests.find(v => v.id === reqId);
      if (!r) return respond(res, 404, { error: 'Not found' });
      Object.assign(r, req.body, { reviewedBy: MOCK_ACCOUNT_ID, reviewedAt: now(), updatedAt: now() });
      if (req.body.status === 'approved') { r.verifiedAt = now(); r.expiresAt = later(8760); }
      return respond(res, 200, { request: r });
    }

    if (route === 'verify/my-status' && req.method === 'GET') {
      const r = STORE.verificationRequests.filter(v => v.requesterId === MOCK_ACCOUNT_ID).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return respond(res, 200, { request: r || null, profileId: MOCK_PROFILE_ID, verified: r?.status === 'approved' });
    }

    // ── WAITLIST ──────────────────────────────────────────
    const wlMatch = route.match(/^waitlist\/(.+)$/);
    if (wlMatch) {
      const eventId = wlMatch[1];

      if (req.method === 'GET') {
        const entries = STORE.waitlistQueue.filter(w => w.eventId === eventId).sort((a, b) => a.position - b.position);
        const waiting = entries.filter(w => w.status === 'waiting').length;
        const analytics = { totalWaiting: waiting, totalInvited: entries.filter(w => w.status === 'invited').length, totalConverted: entries.filter(w => w.status === 'converted').length, totalExpired: entries.filter(w => w.status === 'expired').length, averageWaitTimeSeconds: waiting > 0 ? Math.round(entries.filter(w => w.status === 'waiting').reduce((s, w) => s + w.waitTimeSeconds, 0) / waiting) : 0, conversionRate: entries.length > 0 ? Math.round((entries.filter(w => w.status === 'converted').length / entries.length) * 100) : 0 };
        return respond(res, 200, { entries, analytics });
      }

      if (req.method === 'POST' && route.endsWith('/join')) {
        const maxPos = Math.max(0, ...STORE.waitlistQueue.filter(w => w.eventId === eventId).map(w => w.position));
        const entry = { id: id(), eventId, userId: MOCK_ACCOUNT_ID, userName: 'Dev User', position: maxPos + 1, status: 'waiting', invitedAt: null, inviteExpiresAt: null, convertedAt: null, waitTimeSeconds: 0, source: 'manual', createdAt: now() };
        STORE.waitlistQueue.push(entry);
        return respond(res, 200, { entry });
      }

      if (req.method === 'POST' && route.includes('/invite/')) {
        const wlId = segments[2];
        const entry = STORE.waitlistQueue.find(w => w.id === wlId);
        if (!entry) return respond(res, 404, { error: 'Not found' });
        entry.status = 'invited';
        entry.invitedAt = now();
        entry.inviteExpiresAt = later(6);
        return respond(res, 200, { entry });
      }

      if (req.method === 'POST' && route.includes('/reassign/')) {
        const wlId = segments[2];
        const entry = STORE.waitlistQueue.find(w => w.id === wlId);
        if (!entry) return respond(res, 404, { error: 'Not found' });
        entry.status = 'expired';
        const nextWaiting = STORE.waitlistQueue.filter(w => w.eventId === entry.eventId && w.status === 'waiting').sort((a, b) => a.position - b.position)[0];
        if (nextWaiting) { nextWaiting.status = 'invited'; nextWaiting.invitedAt = now(); nextWaiting.inviteExpiresAt = later(6); }
        return respond(res, 200, { expired: entry, nextInvited: nextWaiting || null });
      }
    }

    if (route === 'waitlist/config' && req.method === 'PUT') {
      return respond(res, 200, { config: { autoInviteEnabled: true, inviteExpiryHours: 6, maxWaitlistSize: 200, notifyOnSlotAvailable: true, ...req.body } });
    }

    // ── FRAUD + RISK ──────────────────────────────────────
    if (route === 'fraud/score' && req.method === 'POST') {
      const { eventId } = req.body;
      // In production: recalculate all scores
      return respond(res, 200, { scores: STORE.fraudScores.filter(s => s.eventId === eventId), recalculated: true });
    }

    if (route.startsWith('fraud/scores/')) {
      const eventId = segments[2];
      return respond(res, 200, { scores: STORE.fraudScores.filter(s => s.eventId === eventId).map(s => ({ ...s })) });
    }

    if (route.startsWith('fraud/review/') && req.method === 'POST') {
      const fsId = segments[2];
      const score = STORE.fraudScores.find(s => s.id === fsId);
      if (!score) return respond(res, 404, { error: 'Not found' });
      Object.assign(score, req.body, { reviewed: true, reviewedBy: MOCK_ACCOUNT_ID, updatedAt: now() });
      return respond(res, 200, { score });
    }

    if (route === 'fraud/dashboard' && req.method === 'GET') {
      const scores = STORE.fraudScores;
      const events = STORE.fraudEvents;
      const summary = { totalScores: scores.length, highRiskCount: scores.filter(s => s.riskScore >= 70).length, blockedCount: scores.filter(s => s.actionTaken === 'block').length, flaggedCount: scores.filter(s => s.actionTaken === 'flag').length, recentFraudEvents: events.sort((a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()).slice(0, 10), riskDistribution: [
        { level: 'Low (0-30)', count: scores.filter(s => s.riskScore < 30).length },
        { level: 'Medium (30-69)', count: scores.filter(s => s.riskScore >= 30 && s.riskScore < 70).length },
        { level: 'High (70+)', count: scores.filter(s => s.riskScore >= 70).length },
      ] };
      return respond(res, 200, summary);
    }

    // ── CALENDAR ──────────────────────────────────────────
    if (route.match(/^calendar\/ics\//) && req.method === 'POST') {
      const eventId = segments[2];
      const payload = await getEventCalendarPayload(eventId);
      if (!payload) return respond(res, 404, { error: 'Event not found' });
      return respond(res, 200, { ics: payload.ics, filename: `event-${eventId}.ics`, mimeType: 'text/calendar' });
    }

    if (route.match(/^calendar\/links\//)) {
      const eventId = segments[2];
      const payload = await getEventCalendarPayload(eventId);
      if (!payload) return respond(res, 404, { error: 'Event not found' });
      return respond(res, 200, buildCalendarLinks(payload));
    }

    if (route === 'calendar/reminders' && req.method === 'GET') {
      const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : '';
      const reminders = STORE.reminders
        .filter((r) => !eventId || r.eventId === eventId)
        .filter((r) => r.userId === MOCK_ACCOUNT_ID)
        .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
      return respond(res, 200, { reminders });
    }

    if (route === 'calendar/reminder' && req.method === 'POST') {
      const { eventId, reminderType, remindAt, channel, recipient, destination } = req.body || {};
      if (!eventId || !remindAt || !channel) return respond(res, 400, { error: 'eventId, remindAt, channel required' });
      const payload = await getEventCalendarPayload(eventId);
      if (!payload) return respond(res, 404, { error: 'Event not found' });
      const normalizedDestination =
        destination ||
        (channel === 'email' ? 'user@email.example' :
        channel === 'whatsapp' ? 'whatsapp:+10000000000' :
        channel === 'sms' ? '+10000000000' : 'in_app');
      const rem = {
        id: id(),
        eventId,
        userId: MOCK_ACCOUNT_ID,
        remindAt,
        reminderType: reminderType || 'custom',
        sent: false,
        sentAt: null,
        channel,
        recipient: recipient || 'Dev User',
        destination: normalizedDestination,
        deliveryStatus: 'scheduled',
        messagePreview: `Reminder: ${payload.summary} starts at ${payload.start.toLocaleString()}`,
        createdAt: now(),
      };
      STORE.reminders.push(rem);
      return respond(res, 200, { reminder: rem });
    }

    if (route.startsWith('calendar/reminder/') && req.method === 'DELETE') {
      const idx = STORE.reminders.findIndex(r => r.id === segments[2]);
      if (idx >= 0) STORE.reminders.splice(idx, 1);
      return respond(res, 200, { deleted: true });
    }

    // ── SUPPORT TICKETS ───────────────────────────────────
    if (route === 'support/tickets' && req.method === 'GET') {
      return respond(res, 200, { tickets: STORE.supportTickets.map(t => ({ ...t, messages: STORE.supportMessages.filter(m => m.ticketId === t.id) })) });
    }

    if (route === 'support/tickets' && req.method === 'POST') {
      const t = { id: id(), ...req.body, requesterId: MOCK_ACCOUNT_ID, status: 'open', escalationLevel: 0, escalatedAt: null, resolvedAt: null, resolutionNotes: '', createdAt: now(), updatedAt: now(), messages: [] };
      STORE.supportTickets.push(t);
      return respond(res, 200, { ticket: t });
    }

    if (route.startsWith('support/tickets/') && req.method === 'GET') {
      const ticketId = segments[2];
      const t = STORE.supportTickets.find(t => t.id === ticketId);
      if (!t) return respond(res, 404, { error: 'Not found' });
      return respond(res, 200, { ...t, messages: STORE.supportMessages.filter(m => m.ticketId === ticketId) });
    }

    if (route.includes('/tickets/') && route.endsWith('/message') && req.method === 'POST') {
      const ticketId = segments[2];
      const msg = { id: id(), ticketId, senderId: MOCK_ACCOUNT_ID, ...req.body, createdAt: now() };
      STORE.supportMessages.push(msg);
      return respond(res, 200, { message: msg });
    }

    if (route.includes('/tickets/') && route.endsWith('/status') && req.method === 'POST') {
      const ticketId = segments[2];
      const t = STORE.supportTickets.find(t => t.id === ticketId);
      if (!t) return respond(res, 404, { error: 'Not found' });
      Object.assign(t, req.body, { updatedAt: now() });
      if (req.body.status === 'resolved' || req.body.status === 'closed') t.resolvedAt = now();
      return respond(res, 200, { ticket: t });
    }

    // ── SUPPORT KB ───────────────────────────────────────
    if (route === 'support/kb' && req.method === 'GET') {
      let articles = STORE.supportKnowledgeBase || [];
      const q = (req.query.q as string || '').toLowerCase();
      if (q) articles = articles.filter(a => a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q) || (a.tags || []).some((t: string) => t.toLowerCase().includes(q)));
      return respond(res, 200, { articles });
    }

    if (route === 'support/kb' && req.method === 'POST') {
      const article = { id: id(), ...req.body, helpfulCount: 0, notHelpfulCount: 0, isPublished: true, createdAt: now(), updatedAt: now() };
      STORE.supportKnowledgeBase.push(article);
      return respond(res, 200, { article });
    }

    if (route.startsWith('support/kb/feedback/') && req.method === 'POST') {
      const articleId = segments[3];
      const article = (STORE.supportKnowledgeBase || []).find(a => a.id === articleId);
      if (!article) return respond(res, 404, { error: 'Not found' });
      if (req.body.helpful) article.helpfulCount++; else article.notHelpfulCount++;
      return respond(res, 200, { article });
    }

    // ── GENDER RULES ─────────────────────────────────────
    if (route.match(/^gender-rules\//)) {
      const eventId = segments[1];
      if (req.method === 'GET') return respond(res, 200, { genderRule: 'any', genderRatio: {}, customEntryRestrictions: '', entryApprovalRequired: false });
      if (req.method === 'PUT') return respond(res, 200, { genderRule: req.body.genderRule, genderRatio: req.body.genderRatio || {}, customEntryRestrictions: req.body.customEntryRestrictions || '', entryApprovalRequired: req.body.entryApprovalRequired || false });
    }

    // ── TABLE SEATING ───────────────────────────────────
    if (route.match(/^tables\//)) {
      const eventId = segments[1];

      if (req.method === 'GET' && route.endsWith('/sections')) {
        return respond(res, 200, { sections: STORE.tableSections.filter(s => s.eventId === eventId) });
      }

      if (req.method === 'GET') {
        const sections = STORE.tableSections.filter(s => s.eventId === eventId);
        const reservations = STORE.tableReservations.filter(r => r.eventId === eventId);
        return respond(res, 200, { sections, reservations });
      }

      if (req.method === 'POST' && route.includes('/section')) {
        const s = { id: id(), eventId, ...req.body, createdAt: now(), updatedAt: now() };
        STORE.tableSections.push(s);
        return respond(res, 200, { section: s });
      }

      if (req.method === 'PUT' && route.includes('/section/')) {
        const sId = segments[3];
        const s = STORE.tableSections.find(x => x.id === sId);
        if (!s) return respond(res, 404, { error: 'Not found' });
        Object.assign(s, req.body, { updatedAt: now() });
        return respond(res, 200, { section: s });
      }

      if (req.method === 'POST' && route.endsWith('/reserve')) {
        const r = { id: id(), eventId, ...req.body, createdAt: now(), updatedAt: now() };
        STORE.tableReservations.push(r);
        return respond(res, 200, { reservation: r });
      }

      if (req.method === 'DELETE' && route.includes('/section/')) {
        const sId = segments[3];
        const idx = STORE.tableSections.findIndex(x => x.id === sId);
        if (idx >= 0) STORE.tableSections.splice(idx, 1);
        return respond(res, 200, { deleted: true });
      }
    }

    // ── BAG RULES ───────────────────────────────────────
    if (route.match(/^bag-rules\//)) {
      if (req.method === 'GET') return respond(res, 200, { bagPolicy: 'any', lockerAvailable: false, lockerCostCents: 0, lockerInfo: '', storageInfo: '', upgradedProhibitedItems: [] });
      if (req.method === 'PUT') return respond(res, 200, req.body);
    }

    // ── HOST TRUST ──────────────────────────────────────
    if (route.match(/^host\/trust-score\//)) {
      return respond(res, 200, { trustScore: 92, totalEvents: 14, avgRating: 4.3, responseRate: 98, verifiedSince: '2025-12-01' });
    }

    if (route.match(/^host\/badge\//)) {
      return respond(res, 200, { verified: true, level: 'premium', since: '2025-12-01', badgeUrl: '/badges/verified-premium.svg' });
    }

    return respond(res, 404, { error: 'Route not found', path: route, method: req.method });

  } catch (err: any) {
    return respond(res, 500, { error: err.message || 'Internal error' });
  }
}
