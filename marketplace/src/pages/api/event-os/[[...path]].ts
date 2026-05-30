import type { NextApiRequest, NextApiResponse } from 'next';
import { query, transaction } from '@/lib/db';
import { getSessionUserId, getAccountId, getUserDisplay } from '@/lib/session';
import { createOrder, verifySignature } from '@/lib/razorpay';
import { getBusinessBankConfig } from '@/lib/businessBank';
import { calculatePlatformFee, DEFAULT_PAYMENT_CURRENCY } from '@/lib/platformFees';

const ok = (r: NextApiResponse, d: any) => r.status(200).json(d);
const created = (r: NextApiResponse, d: any) => r.status(201).json(d);
const noContent = (r: NextApiResponse) => r.status(204).end();
const bad = (r: NextApiResponse, m: string) => r.status(400).json({ error: m });
const notFound = (r: NextApiResponse) => r.status(404).json({ error: 'Not found' });
const unauthorized = (r: NextApiResponse) => r.status(401).json({ error: 'Unauthorized' });
const serverError = (r: NextApiResponse, m: string) => r.status(500).json({ error: m });

let ticketPaymentSchemaReady = false;

async function ensureTicketPaymentSchema() {
  if (ticketPaymentSchemaReady) return;

  await query(`
    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS payment_provider TEXT,
      ADD COLUMN IF NOT EXISTS payment_order_ref TEXT,
      ADD COLUMN IF NOT EXISTS payment_ref TEXT,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
      ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_amount_cents INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fee_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS settlement_account_label TEXT
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_payment_ref ON tickets(payment_ref)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_payment_order_ref ON tickets(payment_order_ref)');

  ticketPaymentSchemaReady = true;
}

async function getEventSummary(eventId: number) {
  const result = await query(
    `SELECT e.id, e.title, e.host_user_id, e.currency, a.display_name AS host_name
     FROM events e
     LEFT JOIN accounts a ON a.id = e.host_user_id
     WHERE e.id = $1
     LIMIT 1`,
    [eventId]
  );

  return result.rows[0] || null;
}

async function getTierSummary(eventId: number, tierId?: string | number | null) {
  const hasSpecificTier = tierId && String(tierId) !== 'general';
  const params = hasSpecificTier ? [parseInt(String(tierId), 10), eventId] : [eventId];
  const sql = hasSpecificTier
    ? `SELECT id, event_id, tier_type, name, price_cents, quantity, remaining, description
       FROM event_ticket_tiers
       WHERE id = $1 AND event_id = $2
       LIMIT 1`
    : `SELECT id, event_id, tier_type, name, price_cents, quantity, remaining, description
       FROM event_ticket_tiers
       WHERE event_id = $1
       ORDER BY price_cents, id
       LIMIT 1`;

  const result = await query(sql, params);
  return result.rows[0] || null;
}

function buildTicketResponse(row: any) {
  return {
    id: row.id,
    eventId: String(row.event_id),
    userId: row.user_id ? String(row.user_id) : null,
    attendeeId: row.attendee_id ? String(row.attendee_id) : `att-${row.user_id}`,
    ticketType: row.ticket_type || 'general',
    ticketCode: row.ticket_code,
    encryptedPayload: row.encrypted_payload || '',
    antiForgeryToken: row.anti_forgery_token || '',
    priceCents: row.price_cents || 0,
    status: row.status,
    scanCount: row.scan_count || 0,
    lastScannedAt: row.last_scanned_at || null,
    walletUrl: row.wallet_url || '',
    transferCount: row.transfer_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    paymentProvider: row.payment_provider || null,
    paymentRef: row.payment_ref || null,
    paymentOrderRef: row.payment_order_ref || null,
    currency: row.currency || DEFAULT_PAYMENT_CURRENCY,
    platformFeeCents: row.platform_fee_cents || 0,
    netAmountCents: row.net_amount_cents || 0,
    feeStatus: row.fee_status || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : path || '';
  const cookie = req.headers.cookie || '';
  const sessionUser = await getSessionUserId(cookie);
  const accountId = await getAccountId(cookie);

  if (!sessionUser || !accountId) return unauthorized(res);

  const parts = pathStr.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];
  const sub = parts[2];
  const action = parts[3];

  try {
    switch (resource) {

       // ── TICKETS ──
       case 'tickets': {
         if (req.method === 'POST' && id === 'create-order') {
           if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
             return bad(res, 'Missing Razorpay credentials in marketplace/.env.local');
           }

           await ensureTicketPaymentSchema();

           const { eventId: eid, tierId } = req.body || {};
           if (!eid) return bad(res, 'eventId required');
           const eventIdNum = parseInt(String(eid), 10);
           if (Number.isNaN(eventIdNum)) return bad(res, 'Invalid eventId');

           const [eventRow, tier] = await Promise.all([
             getEventSummary(eventIdNum),
             getTierSummary(eventIdNum, tierId),
           ]);

           if (!eventRow) return notFound(res);
           if (!tier) return bad(res, 'Ticket tier not found');
           if (eventRow.host_user_id && Number(eventRow.host_user_id) === accountId) {
             return bad(res, 'Hosts cannot buy tickets to their own event');
           }
           if (tier.remaining <= 0 && tier.quantity < 999999) {
             return bad(res, 'This tier is sold out');
           }

           const existing = await query(
             `SELECT * FROM tickets
              WHERE event_id = $1 AND user_id = $2 AND status IN ('active', 'used')
              LIMIT 1`,
             [eventIdNum, accountId]
           );
           if (existing.rows.length > 0) {
             return ok(res, {
               alreadyOwned: true,
               ticket: buildTicketResponse(existing.rows[0]),
             });
           }

           const grossAmountCents = Number(tier.price_cents || 0);
           if (grossAmountCents <= 0) {
             return bad(res, 'Use direct ticket generation for free tiers');
           }

           const feeBreakdown = calculatePlatformFee(grossAmountCents);
           const businessBank = getBusinessBankConfig();
           const order = await createOrder({
             amount: grossAmountCents,
             currency: DEFAULT_PAYMENT_CURRENCY,
             receipt: `evt_${eventIdNum}_${accountId}_${Date.now()}`,
             notes: {
               source: 'valueskins_ticket_checkout',
               event_id: String(eventIdNum),
               tier_id: String(tier.id),
               buyer_account_id: String(accountId),
               platform_fee_cents: String(feeBreakdown.feeCents),
               net_amount_cents: String(feeBreakdown.netAmountCents),
               settlement_account_label: businessBank.label,
             },
           });

           if (!order.success) {
             return serverError(res, 'Failed to create Razorpay order');
           }

           return ok(res, {
             keyId: process.env.RAZORPAY_KEY_ID,
             order: order.data,
             event: {
               id: String(eventRow.id),
               title: eventRow.title,
               hostName: eventRow.host_name || 'Event host',
             },
             ticketPricing: {
               tierId: String(tier.id),
               tierName: tier.name || tier.tier_type || 'General Admission',
               grossAmountCents: feeBreakdown.grossAmountCents,
               platformFeeCents: feeBreakdown.feeCents,
               netAmountCents: feeBreakdown.netAmountCents,
               currency: DEFAULT_PAYMENT_CURRENCY,
             },
           });
         }

         if (req.method === 'POST' && id === 'confirm-payment') {
           await ensureTicketPaymentSchema();

           const {
             eventId: eid,
             tierId,
             razorpay_order_id: orderId,
             razorpay_payment_id: paymentId,
             razorpay_signature: signature,
           } = req.body || {};

           if (!eid || !orderId || !paymentId || !signature) {
             return bad(res, 'eventId and Razorpay payment fields are required');
           }

           const eventIdNum = parseInt(String(eid), 10);
           if (Number.isNaN(eventIdNum)) return bad(res, 'Invalid eventId');

           const signatureValid = await verifySignature(String(orderId), String(paymentId), String(signature));
           if (!signatureValid) {
             return bad(res, 'Payment signature verification failed');
           }

           const eventRow = await getEventSummary(eventIdNum);
           if (!eventRow) return notFound(res);

           const ticket = await transaction(async (tx) => {
             const paymentExisting = await tx(
               'SELECT * FROM tickets WHERE payment_ref = $1 LIMIT 1',
               [paymentId]
             );
             if (paymentExisting.rows.length > 0) {
               return paymentExisting.rows[0];
             }

             const alreadyOwned = await tx(
               `SELECT * FROM tickets
                WHERE event_id = $1 AND user_id = $2 AND status IN ('active', 'used')
                LIMIT 1`,
               [eventIdNum, accountId]
             );
             if (alreadyOwned.rows.length > 0) {
               return alreadyOwned.rows[0];
             }

             const tier = await (async () => {
               const hasSpecificTier = tierId && String(tierId) !== 'general';
               const params = hasSpecificTier ? [parseInt(String(tierId), 10), eventIdNum] : [eventIdNum];
               const sql = hasSpecificTier
                 ? `SELECT id, event_id, tier_type, name, price_cents, quantity, remaining
                    FROM event_ticket_tiers
                    WHERE id = $1 AND event_id = $2
                    FOR UPDATE`
                 : `SELECT id, event_id, tier_type, name, price_cents, quantity, remaining
                    FROM event_ticket_tiers
                    WHERE event_id = $1
                    ORDER BY price_cents, id
                    LIMIT 1
                    FOR UPDATE`;
               const tierResult = await tx(sql, params);
               return tierResult.rows[0] || null;
             })();

             if (!tier) {
               throw new Error('Ticket tier not found');
             }
             if (tier.remaining <= 0 && tier.quantity < 999999) {
               throw new Error('This tier is sold out');
             }

             await tx(
               'UPDATE event_ticket_tiers SET remaining = GREATEST(remaining - 1, 0) WHERE id = $1',
               [tier.id]
             );

             const feeBreakdown = calculatePlatformFee(Number(tier.price_cents || 0));
             const businessBank = getBusinessBankConfig();
             const code = `VS-${String(eid).slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
             const inserted = await tx(
               `INSERT INTO tickets (
                  event_id, user_id, ticket_type, ticket_code, encrypted_payload, anti_forgery_token,
                  price_cents, status, scan_count, wallet_url, transfer_count,
                  payment_provider, payment_order_ref, payment_ref, currency,
                  platform_fee_cents, net_amount_cents, fee_status, settlement_account_label
                )
                VALUES (
                  $1, $2, $3, $4, $5, $6,
                  $7, 'active', 0, $8, 0,
                  $9, $10, $11, $12,
                  $13, $14, 'collected', $15
                )
                RETURNING *`,
               [
                 eventIdNum,
                 accountId,
                 tier.tier_type || 'general',
                 code,
                 '',
                 `aft-${Math.random().toString(36).slice(2, 10)}`,
                 Number(tier.price_cents || 0),
                 `https://wallet.valueskins.com/pass/${code}`,
                 'razorpay',
                 String(orderId),
                 String(paymentId),
                 DEFAULT_PAYMENT_CURRENCY,
                 feeBreakdown.feeCents,
                 feeBreakdown.netAmountCents,
                 businessBank.label,
               ]
             );

             return inserted.rows[0];
           });

           const userResult = await query(
             'SELECT display_name, username FROM users WHERE id = $1',
             [accountId]
           );
           const displayName = userResult.rows[0]?.display_name || userResult.rows[0]?.username || `User-${accountId}`;

           return created(res, {
             ...buildTicketResponse(ticket),
             attendeeId: `att-${accountId}`,
             antiForgeryToken: ticket.anti_forgery_token || '',
             encryptedPayload: ticket.encrypted_payload || '',
             userName: displayName,
           });
         }

         if (req.method === 'POST' && id === 'generate') {
           await ensureTicketPaymentSchema();
           const { eventId: eid, ticketType: ttype, priceCents: pc, tierId } = req.body || {};
           if (!eid) return bad(res, 'eventId required');
           const eventIdNum = parseInt(String(eid), 10);
           if (Number.isNaN(eventIdNum)) return bad(res, 'Invalid eventId');

           const existing = await query(
             `SELECT id FROM tickets WHERE event_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
             [eventIdNum, accountId]
           );
           if (existing.rows.length > 0) {
             const t = existing.rows[0];
             const full = await query('SELECT * FROM tickets WHERE id = $1', [t.id]);
             const row = full.rows[0];
             return ok(res, {
               id: row.id, eventId: String(row.event_id), userId: String(row.user_id),
               ticketType: ttype || 'general', ticketCode: row.ticket_code, status: row.status,
               priceCents: pc || 0, transferCount: row.transfer_count, createdAt: row.created_at,
             });
           }

           if (tierId && tierId !== 'general') {
             const tierResult = await query(
               'SELECT id, remaining, quantity FROM event_ticket_tiers WHERE id = $1 AND event_id = $2',
               [parseInt(String(tierId), 10), eventIdNum]
             );
             if (tierResult.rows.length > 0) {
               const tier = tierResult.rows[0];
               if (tier.remaining <= 0 && tier.quantity < 999999) {
                 return bad(res, 'This tier is sold out');
               }
               await query(
                 'UPDATE event_ticket_tiers SET remaining = GREATEST(remaining - 1, 0) WHERE id = $1',
                 [tier.id]
               );
             }
           } else {
             const tiers = await query(
               'SELECT id, remaining, quantity FROM event_ticket_tiers WHERE event_id = $1 ORDER BY price_cents LIMIT 1',
               [eventIdNum]
             );
             if (tiers.rows.length > 0) {
               const tier = tiers.rows[0];
               if (tier.remaining <= 0 && tier.quantity < 999999) {
                 return bad(res, 'This tier is sold out');
               }
               await query(
                 'UPDATE event_ticket_tiers SET remaining = GREATEST(remaining - 1, 0) WHERE id = $1',
                 [tier.id]
               );
             }
           }

           const code = `VS-${String(eid).slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
           const result = await query(
             `INSERT INTO tickets (
                event_id, user_id, ticket_type, ticket_code, encrypted_payload, anti_forgery_token,
                price_cents, status, scan_count, wallet_url, transfer_count,
                currency, platform_fee_cents, net_amount_cents, fee_status
              )
              VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, 'active', 0, $8, 0,
                $9, 0, $10, 'not_applicable'
              )
              RETURNING *`,
             [
               eventIdNum,
               accountId,
               ttype || 'general',
               code,
               '',
               `aft-${Math.random().toString(36).slice(2, 10)}`,
               Number(pc || 0),
               `https://wallet.valueskins.com/pass/${code}`,
               DEFAULT_PAYMENT_CURRENCY,
               Number(pc || 0),
             ]
           );
           const t = result.rows[0];
           // Get the user's display name
           const userResult = await query(
             'SELECT display_name, username FROM users WHERE id = $1',
             [accountId]
           );
           const displayName = userResult.rows[0]?.display_name || userResult.rows[0]?.username || `User-${accountId}`;
           return created(res, {
             ...buildTicketResponse(t),
             attendeeId: `att-${accountId}`,
             ticketType: ttype || 'general',
             antiForgeryToken: t.anti_forgery_token || '',
             priceCents: pc || 0,
             userName: displayName,
           });
         }

        if (req.method === 'GET' && id && !sub) {
          const result = await query(
            'SELECT * FROM tickets WHERE ticket_code = $1 OR id::text = $1',
            [id]
          );
          if (result.rows.length === 0) return notFound(res);
          const t = result.rows[0];
          return ok(res, buildTicketResponse(t));
        }

        if (req.method === 'GET' && id === 'event' && sub) {
          const result = await query(
            'SELECT * FROM tickets WHERE event_id = $1 AND user_id = $2 ORDER BY created_at DESC',
            [parseInt(sub), accountId]
          );
          return ok(res, {
            tickets: result.rows.map((t: any) => buildTicketResponse(t)),
          });
        }

        if (req.method === 'POST' && id && sub === 'validate') {
          const result = await query('SELECT * FROM tickets WHERE id::text = $1', [id]);
          if (result.rows.length === 0) return ok(res, { valid: false, rejectionReason: 'Ticket not found' });
          const t = result.rows[0];
          if (t.status === 'used') return ok(res, { valid: false, rejectionReason: 'Ticket already used', isDuplicate: true });
          if (t.status !== 'active') return ok(res, { valid: false, rejectionReason: `Ticket ${t.status}` });
          await query("UPDATE tickets SET status = 'used' WHERE id = $1", [t.id]);
          const ci = await query(
            'INSERT INTO check_ins (event_id, ticket_id, scanned_by, scan_method, re_entry) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [t.event_id, t.id, accountId, 'qr', false]
          );
          return ok(res, {
            valid: true, ticket: {
              id: t.id, eventId: String(t.event_id), userId: String(t.user_id), attendeeId: `att-${t.user_id}`,
              ticketType: 'general', ticketCode: t.ticket_code, encryptedPayload: '', antiForgeryToken: '',
              priceCents: 0, status: 'used', scanCount: 1, lastScannedAt: ci.rows[0].entry_time,
              walletUrl: '', transferCount: t.transfer_count, createdAt: t.created_at, updatedAt: t.created_at,
            },
            isReEntry: false, checkIn: { id: ci.rows[0].id, ticketId: t.id, eventId: String(t.event_id), scannedBy: String(accountId), scanMethod: 'qr', entryTime: ci.rows[0].entry_time, reEntry: false, notes: '' },
          });
        }

        if (req.method === 'POST' && id && sub === 'transfer') {
          const result = await query("UPDATE tickets SET transfer_count = transfer_count + 1 WHERE id::text = $1 AND transfer_count < 3 RETURNING *", [id]);
          if (result.rows.length === 0) return bad(res, 'Max 3 transfers allowed or ticket not found');
          const t = result.rows[0];
          return ok(res, { id: t.id, eventId: String(t.event_id), ticketCode: t.ticket_code, status: t.status, transferCount: t.transfer_count });
        }

        if (req.method === 'POST' && id && sub === 'cancel') {
          const result = await query("UPDATE tickets SET status = 'cancelled' WHERE id::text = $1 RETURNING *", [id]);
          if (result.rows.length === 0) return notFound(res);
          return ok(res, { message: 'Ticket cancelled' });
        }

        if (req.method === 'POST' && id && sub === 'wallet') {
          const result = await query('SELECT * FROM tickets WHERE id::text = $1', [id]);
          if (result.rows.length === 0) return notFound(res);
          const t = result.rows[0];
          return ok(res, { walletUrl: `https://wallet.valueskins.com/pass/${t.ticket_code}` });
        }

        return notFound(res);
      }

      // ── CHECK-IN ──
      case 'check-in': {
        if (req.method === 'POST' && id === 'scan') {
          const { ticketCode, ticketId: tid } = req.body || {};
          const code = ticketCode || tid;
          if (!code) return bad(res, 'ticketCode required');
          const tResult = await query('SELECT * FROM tickets WHERE ticket_code = $1 OR id::text = $1', [code]);
          if (tResult.rows.length === 0) return ok(res, { valid: false, rejectionReason: 'Ticket not found' });
          const t = tResult.rows[0];
          if (t.status === 'used') {
            const existing = await query('SELECT * FROM check_ins WHERE ticket_id = $1 ORDER BY entry_time DESC LIMIT 1', [t.id]);
            return ok(res, { valid: true, ticket: { id: t.id, ticketCode: t.ticket_code, status: t.status }, isReEntry: true, checkIn: existing.rows[0] || null, warning: 'Already scanned. Re-entry logged.' });
          }
          if (t.status !== 'active') return ok(res, { valid: false, rejectionReason: `Ticket ${t.status}` });
          await query("UPDATE tickets SET status = 'used' WHERE id = $1", [t.id]);
          const ci = await query(
            'INSERT INTO check_ins (event_id, ticket_id, scanned_by, scan_method, re_entry) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [t.event_id, t.id, accountId, 'qr', false]
          );
          return ok(res, {
            valid: true, ticket: { id: t.id, eventId: String(t.event_id), ticketCode: t.ticket_code, status: 'used' },
            checkIn: { id: ci.rows[0].id, ticketId: t.id, eventId: String(t.event_id), scannedBy: String(accountId), scanMethod: 'qr', entryTime: ci.rows[0].entry_time, reEntry: false, notes: '' },
          });
        }

        if (req.method === 'POST' && id === 'manual') {
          await ensureTicketPaymentSchema();
          const { ticketCode, name, email } = req.body || {};
           const code = ticketCode || `VS-MANUAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const tResult = await query('SELECT * FROM tickets WHERE ticket_code = $1', [code]);
          let t: any;
          if (tResult.rows.length === 0) {
            const newT = await query(
              `INSERT INTO tickets (
                 event_id, user_id, ticket_type, ticket_code, encrypted_payload, anti_forgery_token,
                 price_cents, status, scan_count, wallet_url, transfer_count,
                 currency, platform_fee_cents, net_amount_cents, fee_status
               )
               VALUES (
                 $1, $2, 'general', $3, '', $4,
                 0, 'used', 1, $5, 0,
                 $6, 0, 0, 'not_applicable'
               )
               RETURNING *`,
              [1, accountId, code, `aft-${Math.random().toString(36).slice(2, 10)}`, `https://wallet.valueskins.com/pass/${code}`, DEFAULT_PAYMENT_CURRENCY]
            );
            t = newT.rows[0];
          } else {
            t = tResult.rows[0];
            await query("UPDATE tickets SET status = 'used' WHERE id = $1", [t.id]);
          }
          const ci = await query(
            'INSERT INTO check_ins (event_id, ticket_id, scanned_by, scan_method, re_entry) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [t.event_id, t.id, accountId, 'manual', false]
          );
          return ok(res, {
            valid: true, ticket: { id: t.id, ticketCode: t.ticket_code, status: 'used' },
            checkIn: { id: ci.rows[0].id, ticketId: t.id, eventId: String(t.event_id), scannedBy: String(accountId), scanMethod: 'manual', entryTime: ci.rows[0].entry_time, notes: `${name || ''} | ${email || ''}` },
          });
        }

        if (req.method === 'GET' && id === 'attendees') {
          const result = await query('SELECT id, ticket_code, status FROM tickets ORDER BY created_at DESC');
          return ok(res, { attendees: result.rows.map((t: any) => ({ id: t.id, ticketCode: t.ticket_code, ticketType: 'general', status: t.status })) });
        }

        if (req.method === 'GET' && id === 'event' && sub === 'count') {
          const eid = parts[3] || '1';
          const ci = await query('SELECT COUNT(*) as c FROM check_ins WHERE event_id = $1', [parseInt(eid)]);
          const tk = await query('SELECT COUNT(*) as c FROM tickets WHERE event_id = $1', [parseInt(eid)]);
          return ok(res, { count: parseInt(ci.rows[0].c), total: parseInt(tk.rows[0].c) });
        }

        if (req.method === 'GET' && id === 'logs') {
          const eid = sub || '1';
          const result = await query('SELECT * FROM check_ins WHERE event_id = $1 ORDER BY entry_time DESC', [parseInt(eid)]);
          return ok(res, {
            checkIns: result.rows.map((c: any) => ({
              id: c.id, ticketId: c.ticket_id, eventId: String(c.event_id), scannedBy: String(c.scanned_by),
              scanMethod: c.scan_method, entryTime: c.entry_time, reEntry: c.re_entry, notes: '',
            })),
          });
        }

        return notFound(res);
      }

      // ── ANNOUNCEMENTS ──
      case 'announcements': {
        if (req.method === 'POST' && !id) {
          const { eventId: eid, title, body: bd, type: atype } = req.body || {};
          if (!eid || !title || !bd) return bad(res, 'eventId, title, body required');
          const result = await query(
            'INSERT INTO event_announcements (event_id, title, body, type, host_id, is_pinned) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [parseInt(eid), title, bd, atype || 'info', accountId, false]
          );
          const a = result.rows[0];
          return created(res, {
            id: a.id, eventId: String(a.event_id), hostId: String(a.host_id),
            title: a.title, body: a.body, type: a.type,
            priority: a.is_pinned ? 'high' : 'normal', isPinned: a.is_pinned,
            pushSent: false, sentAt: null, createdAt: a.created_at,
          });
        }

        if (req.method === 'GET' && id === 'event' && sub) {
          const result = await query(
            'SELECT * FROM event_announcements WHERE event_id = $1 ORDER BY is_pinned DESC, created_at DESC',
            [parseInt(sub)]
          );
          return ok(res, {
            announcements: result.rows.map((a: any) => ({
              id: a.id, eventId: String(a.event_id), hostId: String(a.host_id),
              title: a.title, body: a.body, type: a.type,
              priority: a.is_pinned ? 'high' : 'normal', isPinned: a.is_pinned,
              pushSent: false, sentAt: null, createdAt: a.created_at,
            })),
          });
        }

        if (req.method === 'PUT' && id && sub === 'pin') {
          const result = await query(
            'UPDATE event_announcements SET is_pinned = NOT is_pinned WHERE id::text = $1 RETURNING *',
            [id]
          );
          if (result.rows.length === 0) return notFound(res);
          return ok(res, { message: 'Toggled pin' });
        }

        if (req.method === 'DELETE' && id) {
          await query('DELETE FROM event_announcements WHERE id::text = $1', [id]);
          return noContent(res);
        }

        return notFound(res);
      }

      // ── CHAT ──
      case 'chat': {
        if (req.method === 'POST' && id === 'messages') {
          const { eventId: eid, message: msg, messageType: mt } = req.body || {};
          if (!eid || !msg) return bad(res, 'eventId and message required');
          const senderName = await getUserDisplay(sessionUser);
          const result = await query(
            'INSERT INTO event_chat_messages (event_id, sender_id, message, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [parseInt(eid), accountId, msg, mt || 'text']
          );
          const m = result.rows[0];
          return created(res, {
            id: m.id, eventId: String(m.event_id), senderId: String(m.sender_id),
            senderName, message: m.message, messageType: m.message_type,
            isPinned: false, isAnnouncement: false, isModerated: false,
            replyTo: null, createdAt: m.created_at,
          });
        }

        if (req.method === 'GET' && id === 'event' && sub) {
          const result = await query(
            'SELECT * FROM event_chat_messages WHERE event_id = $1 ORDER BY created_at ASC',
            [parseInt(sub)]
          );
          return ok(res, {
            messages: result.rows.map((m: any) => ({
              id: m.id, eventId: String(m.event_id), senderId: String(m.sender_id),
              senderName: m.sender_name || '', message: m.message, messageType: m.message_type,
              isPinned: false, isAnnouncement: false, isModerated: false,
              replyTo: null, createdAt: m.created_at,
            })),
          });
        }

        if (req.method === 'POST' && id && sub === 'moderate') {
          await query('DELETE FROM event_chat_messages WHERE id::text = $1', [id]);
          return ok(res, { message: 'Message moderated' });
        }

        return notFound(res);
      }

      // ── FAQ ──
      case 'faq': {
        if (req.method === 'GET' && id === 'event' && sub) {
          const result = await query(
            'SELECT * FROM event_faqs WHERE event_id = $1 ORDER BY sort_order',
            [parseInt(sub)]
          );
          return ok(res, {
            faqs: result.rows.map((f: any) => ({
              id: String(f.id), eventId: String(f.event_id), question: f.question, answer: f.answer,
              isAutoGenerated: f.is_auto_generated, isVisible: true,
              sortOrder: f.sort_order, createdAt: f.created_at, updatedAt: f.created_at,
            })),
          });
        }

        if (req.method === 'POST' && id === 'generate') {
          const { eventId: eid, ...meta } = req.body || {};
          if (!eid) return bad(res, 'eventId required');
          const generated = [
            { question: 'Can I come solo?', answer: 'Yes! Many attendees come alone. Its a social event designed for meeting people.' },
            { question: meta.dressCode ? 'What is the dress code?' : 'Can I re-enter?', answer: meta.dressCode || 'Re-entry is subject to venue policy.' },
            { question: meta.ageRestriction > 0 ? `Is there an age restriction?` : 'Is parking available?', answer: meta.ageRestriction > 0 ? `You must be ${meta.ageRestriction}+` : (meta.parkingInfo || 'Parking details on arrival.') },
            { question: 'Can I get a refund?', answer: meta.refundPolicy || 'Refund policy set by host.' },
          ];
          const inserted: any[] = [];
          for (let i = 0; i < generated.length; i++) {
            const r = await query(
              'INSERT INTO event_faqs (event_id, question, answer, is_auto_generated, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [parseInt(eid), generated[i].question, generated[i].answer, true, i]
            );
            const f = r.rows[0];
            inserted.push({ id: String(f.id), eventId: String(f.event_id), question: f.question, answer: f.answer, isAutoGenerated: true, isVisible: true, sortOrder: f.sort_order, createdAt: f.created_at, updatedAt: f.created_at });
          }
          return created(res, { faqs: inserted });
        }

        if (req.method === 'POST' && !id) {
          const { eventId: eid, question: q, answer: a } = req.body || {};
          if (!eid || !q || !a) return bad(res, 'eventId, question, answer required');
          const count = await query('SELECT COUNT(*) as c FROM event_faqs WHERE event_id = $1', [parseInt(eid)]);
          const result = await query(
            'INSERT INTO event_faqs (event_id, question, answer, is_auto_generated, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [parseInt(eid), q, a, false, parseInt(count.rows[0].c)]
          );
          const f = result.rows[0];
          return created(res, { id: String(f.id), eventId: String(f.event_id), question: f.question, answer: f.answer, isAutoGenerated: false, isVisible: true, sortOrder: f.sort_order, createdAt: f.created_at, updatedAt: f.created_at });
        }

        if (req.method === 'PUT' && id) {
          const result = await query(
            'UPDATE event_faqs SET question = $1, answer = $2 WHERE id::text = $3 RETURNING *',
            [req.body.question, req.body.answer, id]
          );
          if (result.rows.length === 0) return notFound(res);
          return ok(res, { message: 'FAQ updated' });
        }

        if (req.method === 'DELETE' && id) {
          await query('DELETE FROM event_faqs WHERE id::text = $1', [id]);
          return noContent(res);
        }

        return notFound(res);
      }

      // ── SAFETY ──
      case 'safety': {
        if (req.method === 'POST' && id === 'report') {
          const { eventId: eid, reportedId: rid, reportType: rt, reason: rsn, severity: sev } = req.body || {};
          if (!rt || !rsn) return bad(res, 'reportType and reason required');
          const result = await query(
            'INSERT INTO safety_reports (event_id, reporter_id, reported_id, report_type, reason, severity, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [eid ? parseInt(eid) : null, accountId, rid ? parseInt(rid) : null, rt, rsn, sev || 'low', 'open']
          );
          const r = result.rows[0];
          return created(res, { id: r.id, eventId: String(r.event_id), reporterId: String(r.reporter_id), reportedId: String(r.reported_id) || null, reportType: r.report_type, reason: r.reason, severity: r.severity || 'low', status: r.status, createdAt: r.created_at });
        }

        if (req.method === 'GET' && id === 'reports') {
          const eid = sub;
          let result;
          if (eid) {
            result = await query('SELECT * FROM safety_reports WHERE event_id = $1 ORDER BY created_at DESC', [parseInt(eid)]);
          } else {
            result = await query('SELECT * FROM safety_reports ORDER BY created_at DESC');
          }
          return ok(res, { reports: result.rows.map((r: any) => ({ id: r.id, eventId: String(r.event_id), reporterId: String(r.reporter_id), reportedId: String(r.reported_id), reportType: r.report_type, reason: r.reason, status: r.status, createdAt: r.created_at })) });
        }

        if (req.method === 'POST' && id && action === 'resolve') {
          const result = await query(
            "UPDATE safety_reports SET status = 'resolved' WHERE id::text = $1 RETURNING *",
            [id]
          );
          if (result.rows.length === 0) return notFound(res);
          return ok(res, { message: 'Report resolved' });
        }

        if (req.method === 'POST' && id === 'block') {
          const { blockedId: bid, reason: brsn } = req.body || {};
          if (!bid) return bad(res, 'blockedId required');
          await query(
            'INSERT INTO user_blocks (blocker_id, blocked_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [accountId, parseInt(bid), brsn || '']
          );
          return created(res, { id: `${accountId}-${bid}`, blockerId: String(accountId), blockedId: bid, reason: brsn || '', createdAt: new Date().toISOString() });
        }

        if (req.method === 'POST' && id === 'unblock') {
          const { blockedId: bid } = req.body || {};
          await query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [accountId, parseInt(bid)]);
          return ok(res, { message: 'Unblocked' });
        }

        if (req.method === 'GET' && id === 'blocks') {
          const result = await query('SELECT * FROM user_blocks WHERE blocker_id = $1', [accountId]);
          return ok(res, { blocks: result.rows.map((b: any) => ({ id: b.id, blockerId: String(b.blocker_id), blockedId: String(b.blocked_id), reason: b.reason || '', createdAt: b.created_at })) });
        }

        return notFound(res);
      }

      // ── GROUPS ──
      case 'groups': {
        if (req.method === 'POST' && id === 'create') {
          const { eventId: eid, groupName: gn, maxSize: ms } = req.body || {};
          if (!eid) return bad(res, 'eventId required');
          const inviteCode = `GRP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const result = await query(
            'INSERT INTO attendee_groups (event_id, group_name, invite_code, owner_attendee_id, max_size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [parseInt(eid), gn || 'Group', inviteCode, accountId, ms || 10]
          );
          const g = result.rows[0];
          return created(res, { id: g.id, eventId: String(g.event_id), ownerAttendeeId: String(g.owner_attendee_id), groupName: g.group_name, maxSize: g.max_size, inviteCode: g.invite_code, createdAt: g.created_at });
        }

        if (req.method === 'POST' && id === 'join') {
          const { inviteCode: ic } = req.body || {};
          const gResult = await query('SELECT * FROM attendee_groups WHERE invite_code = $1', [ic]);
          if (gResult.rows.length === 0) return notFound(res);
          const g = gResult.rows[0];
          await query(
            'INSERT INTO group_members (group_id, attendee_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [g.id, accountId, 'member']
          );
          return ok(res, { group: { id: g.id, groupName: g.group_name, inviteCode: g.invite_code }, member: { groupId: g.id, userId: String(accountId), role: 'member' } });
        }

        if (req.method === 'GET' && id === 'event' && sub) {
          const eid = parseInt(sub);
          const groupsResult = await query('SELECT * FROM attendee_groups WHERE event_id = $1', [eid]);
          const groups = await Promise.all(groupsResult.rows.map(async (g: any) => {
            const mResult = await query('SELECT * FROM group_members WHERE group_id = $1', [g.id]);
            return {
              id: g.id, eventId: String(g.event_id), ownerAttendeeId: String(g.owner_attendee_id),
              groupName: g.group_name, maxSize: g.max_size, inviteCode: g.invite_code, createdAt: g.created_at,
              members: mResult.rows.map((m: any) => ({ id: m.group_id, groupId: String(m.group_id), attendeeId: String(m.attendee_id), role: m.role, joinedAt: m.joined_at })),
            };
          }));
          return ok(res, { groups });
        }

        if (req.method === 'GET' && id === 'event' && sub && action === 'my-group') {
          const eid = parseInt(sub);
          const gResult = await query(
            'SELECT g.* FROM attendee_groups g JOIN group_members m ON g.id = m.group_id WHERE g.event_id = $1 AND m.attendee_id = $2',
            [eid, accountId]
          );
          if (gResult.rows.length === 0) return ok(res, { group: null });
          const g = gResult.rows[0];
          const mResult = await query('SELECT * FROM group_members WHERE group_id = $1', [g.id]);
          return ok(res, {
            group: { id: g.id, eventId: String(g.event_id), ownerAttendeeId: String(g.owner_attendee_id), groupName: g.group_name, maxSize: g.max_size, inviteCode: g.invite_code, createdAt: g.created_at },
            members: mResult.rows.map((m: any) => ({ id: m.group_id, groupId: String(m.group_id), attendeeId: String(m.attendee_id), role: m.role, joinedAt: m.joined_at })),
          });
        }

        return notFound(res);
      }

      // ── ARRIVAL ──
      case 'arrival': {
        const arrivalEventId = id === 'event' ? (sub ? parseInt(sub) : NaN) : parseInt(id);
        if (isNaN(arrivalEventId)) return notFound(res);

        if (req.method === 'GET') {
          const result = await query('SELECT * FROM arrival_info WHERE event_id = $1 LIMIT 1', [arrivalEventId]);
          if (result.rows.length === 0) return notFound(res);
          const a = result.rows[0];
          const revealed = a.location_reveal_policy === 'purchase' || a.location_reveal_policy === 'approval' || (a.location_reveal_policy === 'time_threshold' && a.reveal_time && new Date() >= new Date(a.reveal_time));
          return ok(res, {
            id: a.id, eventId: String(a.event_id), mapUrl: a.venue_map_url || '',
            navigationDeeplink: a.navigation_deeplink || '',
            parkingDetails: revealed ? (a.parking_details || a.parking_info || '') : '',
            valetInfo: a.valet_info || '',
            gateNumber: revealed ? (a.gate_number || a.gate_info || '') : '',
            floorNumber: revealed ? (a.floor_number || a.floor_info || '') : '',
            tableAssignment: revealed ? (a.table_assignment || a.table_info || '') : '',
            entryRouteDescription: a.entry_route_description || '',
            proximityRadiusMeters: a.proximity_radius_meters || 0,
            locationRevealPolicy: a.location_reveal_policy || 'purchase', revealTime: a.reveal_time || null,
            createdAt: a.created_at, updatedAt: a.updated_at,
          });
        }

        if (req.method === 'POST') {
          const existing = await query('SELECT id FROM arrival_info WHERE event_id = $1', [arrivalEventId]);
          if (existing.rows.length > 0) {
            const result = await query(
              `UPDATE arrival_info SET parking_details = $1, gate_number = $2, floor_number = $3, table_assignment = $4,
               map_url = $5, navigation_deeplink = $6, location_reveal_policy = $7, reveal_time = $8, updated_at = NOW()
               WHERE event_id = $9 RETURNING *`,
              [req.body.parkingDetails || '', req.body.gateNumber || '', req.body.floorNumber || '',
               req.body.tableAssignment || '', req.body.mapUrl || '', req.body.navigationDeeplink || '',
               req.body.locationRevealPolicy || 'purchase', req.body.revealTime || null, arrivalEventId]
            );
            return ok(res, { message: 'Arrival info updated' });
          }
          await query(
            'INSERT INTO arrival_info (event_id, map_url, navigation_deeplink, parking_details, gate_number, floor_number, table_assignment, location_reveal_policy, reveal_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [arrivalEventId, req.body.mapUrl || '', req.body.navigationDeeplink || '', req.body.parkingDetails || '',
             req.body.gateNumber || '', req.body.floorNumber || '', req.body.tableAssignment || '',
             req.body.locationRevealPolicy || 'purchase', req.body.revealTime || null]
          );
          return created(res, { message: 'Arrival info created' });
        }

        return notFound(res);
      }

      // ── ATTENDEE CARDS ──
      case 'cards': {
        const pgArr = (s: any): string[] => {
          if (Array.isArray(s)) return s.filter(Boolean);
          if (!s || s === '{}') return [];
          const m = String(s).match(/^{(.+)}$/);
          return m ? m[1].split(',').map((x: string) => x.trim()).filter(Boolean) : [];
        };

        if (req.method === 'GET' && id && sub === 'card') {
          const uid = parseInt(id);
          let result = await query('SELECT * FROM attendee_cards WHERE user_id = $1', [uid]);
          if (result.rows.length === 0) {
            result = await query(
              "INSERT INTO attendee_cards (user_id, bio, interests, communities, badges) VALUES ($1, $2, ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]) RETURNING *",
              [uid, '']
            );
          }
          const c = result.rows[0];
          return ok(res, {
            id: c.id, userId: String(c.user_id), photoUrl: c.photo_url || '', bio: c.bio || '',
            interests: pgArr(c.interests),
            communities: pgArr(c.communities),
            badges: pgArr(c.badges),
            showValueSkin: c.show_value_skin || false, privacyLevel: c.privacy_level || 'public',
            createdAt: c.created_at, updatedAt: c.updated_at,
          });
        }

        if (req.method === 'PUT' && id && sub === 'card') {
          const uid = parseInt(id);
          const bio = req.body.bio || '';
          const arr = (a: any) => `{${(Array.isArray(a) ? a : []).join(',')}}`;
          const existing = await query('SELECT id FROM attendee_cards WHERE user_id = $1', [uid]);
          if (existing.rows.length === 0) {
            await query(
              "INSERT INTO attendee_cards (user_id, bio, interests, communities) VALUES ($1, $2, $3::text[], $4::text[])",
              [uid, bio, arr(req.body.interests || []), arr(req.body.communities || [])]
            );
          } else {
            await query(
              "UPDATE attendee_cards SET bio = $1, interests = $2::text[], communities = $3::text[], updated_at = NOW() WHERE user_id = $4",
              [bio, arr(req.body.interests || []), arr(req.body.communities || []), uid]
            );
          }
          return ok(res, { message: 'Card updated' });
        }

        if (req.method === 'GET' && id === 'event' && sub) {
          const result = await query('SELECT * FROM attendee_cards ORDER BY updated_at DESC');
          return ok(res, {
            cards: result.rows.map((c: any) => ({
              id: c.id, userId: String(c.user_id), photoUrl: c.photo_url || '', bio: c.bio || '',
              interests: pgArr(c.interests),
              communities: pgArr(c.communities),
              badges: pgArr(c.badges),
              showValueSkin: c.show_value_skin || false, privacyLevel: c.privacy_level || 'public',
              createdAt: c.created_at, updatedAt: c.updated_at,
            })),
          });
        }

        return notFound(res);
      }

      // ── ANALYTICS ──
      case 'analytics': {
        const analyticsEventId = id === 'event' ? (sub ? parseInt(sub) : NaN) : parseInt(id);
        if (req.method === 'GET' && !isNaN(analyticsEventId)) {
          const checkInCount = await query('SELECT COUNT(*) as c FROM check_ins WHERE event_id = $1', [analyticsEventId]);
          const ticketCount = await query('SELECT COUNT(*) as c FROM tickets WHERE event_id = $1', [analyticsEventId]);
          const totalCheckIns = parseInt(checkInCount.rows[0].c);
          const totalTickets = parseInt(ticketCount.rows[0].c);
          const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
          const byHour = await query('SELECT EXTRACT(HOUR FROM entry_time) as h, COUNT(*) as c FROM check_ins WHERE event_id = $1 GROUP BY h ORDER BY h', [analyticsEventId]);
          byHour.rows.forEach((r: any) => { const idx = parseInt(r.h); if (idx >= 0 && idx < 24) hours[idx].count = parseInt(r.c); });
          return ok(res, {
            metrics: { totalCheckIns, noShowCount: totalTickets - totalCheckIns, repeatAttendees: 0, uniqueAttendees: totalCheckIns || totalTickets, peakHour: hours.reduce((a, b) => a.count > b.count ? a : b, hours[0]) },
            heatmap: hours,
            checkInTimeline: [],
          });
        }

        if (req.method === 'GET' && id === 'demographics') {
          return ok(res, { demographics: [] });
        }

        return notFound(res);
      }

      // ── POST-EVENT ──
      case 'post-event': {
        if (req.method === 'POST' && id === 'rate') {
          const { eventId: eid, rating: rt, review: rv } = req.body || {};
          if (!eid || !rt) return bad(res, 'eventId and rating required');
          const existing = await query('SELECT id FROM event_ratings WHERE event_id = $1 AND user_id = $2', [parseInt(eid), accountId]);
          if (existing.rows.length > 0) return bad(res, 'Already rated');
          const result = await query('INSERT INTO event_ratings (event_id, user_id, rating, review) VALUES ($1, $2, $3, $4) RETURNING *', [parseInt(eid), accountId, Math.min(5, Math.max(1, rt)), rv || '']);
          const r = result.rows[0];
          return created(res, { id: r.id, eventId: String(r.event_id), userId: String(r.user_id), rating: r.rating, review: r.review, createdAt: r.created_at });
        }

        if (req.method === 'POST' && id === 'connections') {
          const { eventId: eid, targetId: tid, source } = req.body || {};
          if (!eid || !tid) return bad(res, 'eventId and targetId required');
          const result = await query(
            'INSERT INTO event_connections (event_id, requester_id, target_id, source, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [parseInt(eid), accountId, parseInt(tid), source || 'manual', 'pending']
          );
          const c = result.rows[0];
          return created(res, { id: c.id, eventId: String(c.event_id), requesterId: String(c.requester_id), targetId: String(c.target_id), status: c.status, source: c.source, createdAt: c.created_at, updatedAt: c.updated_at });
        }

        if (req.method === 'GET' && id === 'connections') {
          const eid = sub ? parseInt(sub) : null;
          let result;
          if (eid) {
            result = await query('SELECT * FROM event_connections WHERE event_id = $1 ORDER BY created_at DESC', [eid]);
          } else {
            result = await query('SELECT * FROM event_connections WHERE requester_id = $1 OR target_id = $1 ORDER BY created_at DESC', [accountId]);
          }
          return ok(res, { connections: result.rows.map((c: any) => ({ id: c.id, eventId: String(c.event_id), requesterId: String(c.requester_id), targetId: String(c.target_id), status: c.status, source: c.source || 'manual', createdAt: c.created_at, updatedAt: c.updated_at })) });
        }

        if (req.method === 'PUT' && id === 'connections' && sub) {
          const { status: newStatus } = req.body || {};
          const result = await query('UPDATE event_connections SET status = $1, updated_at = NOW() WHERE id::text = $2 RETURNING *', [newStatus || 'accepted', sub]);
          if (result.rows.length === 0) return notFound(res);
          return ok(res, { message: 'Connection updated' });
        }

        if (req.method === 'GET' && id === 'suggestions') {
          return ok(res, { suggestions: [] });
        }

        return notFound(res);
      }

      // ── COMMAND CENTER ──
      case 'command-center': {
        if (req.method === 'GET') {
          const eid = id ? parseInt(id) : 1;
          const checkInCount = await query('SELECT COUNT(*) as c FROM check_ins WHERE event_id = $1', [eid]);
          const ticketCount = await query('SELECT COUNT(*) as c FROM tickets WHERE event_id = $1', [eid]);
          const annResult = await query('SELECT * FROM event_announcements WHERE event_id = $1 ORDER BY created_at DESC', [eid]);
          const totalCheckIns = parseInt(checkInCount.rows[0].c);
          const totalTickets = parseInt(ticketCount.rows[0].c);
          const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
          const byHour = await query('SELECT EXTRACT(HOUR FROM entry_time) as h, COUNT(*) as c FROM check_ins WHERE event_id = $1 GROUP BY h ORDER BY h', [eid]);
          byHour.rows.forEach((r: any) => { const idx = parseInt(r.h); if (idx >= 0 && idx < 24) hours[idx].count = parseInt(r.c); });
          return ok(res, {
            liveAttendeeCount: totalCheckIns,
            totalTicketsSold: totalTickets,
            totalRevenueCents: 0,
            scanRate: totalTickets > 0 ? Math.round((totalCheckIns / totalTickets) * 100) : 0,
            topPromoters: [],
            recentCheckIns: [],
            activeAnnouncements: annResult.rows.slice(0, 5).map((a: any) => ({ id: a.id, title: a.title, body: a.body, type: a.type, isPinned: a.is_pinned, createdAt: a.created_at })),
            demographics: [],
            heatmap: hours,
            conversionSources: [],
            refundCount: 0,
          });
        }
        return notFound(res);
      }

      // ── AUTOMATION ──
      case 'automation': {
        if (req.method === 'POST' && id === 'schedule') {
          const { eventId: eid, jobType: jt, scheduledFor: sf, payload: pl } = req.body || {};
          if (!eid || !jt || !sf) return bad(res, 'eventId, jobType, scheduledFor required');
          const result = await query(
            'INSERT INTO automation_jobs (event_id, job_type, scheduled_for, payload, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [parseInt(eid), jt, sf, JSON.stringify(pl || {}), 'pending']
          );
          const j = result.rows[0];
          return created(res, { id: j.id, eventId: String(j.event_id), jobType: j.job_type, scheduledFor: j.scheduled_for, status: j.status, createdAt: j.created_at });
        }

        if (req.method === 'GET') {
          const eid = id === 'event' ? (sub ? parseInt(sub) : NaN) : parseInt(id);
          if (!isNaN(eid)) {
            const result = await query('SELECT * FROM automation_jobs WHERE event_id = $1 ORDER BY created_at DESC', [eid]);
            return ok(res, { jobs: result.rows.map((j: any) => ({ id: j.id, eventId: String(j.event_id), jobType: j.job_type, scheduledFor: j.scheduled_for, executedAt: j.executed_at, status: j.status, error: j.error, retryCount: j.retry_count, maxRetries: j.max_retries, createdAt: j.created_at })) });
          }
        }

        if (req.method === 'DELETE' && id) {
          await query('DELETE FROM automation_jobs WHERE id::text = $1', [id]);
          return noContent(res);
        }

        if (req.method === 'POST' && id === 'execute') {
          const { jobType: jt, eventId: eid } = req.body || {};
          const result = await query(
            "INSERT INTO automation_jobs (event_id, job_type, scheduled_for, executed_at, status) VALUES ($1, $2, NOW(), NOW(), 'completed') RETURNING *",
            [eid ? parseInt(eid) : 1, jt || 'reminder']
          );
          const j = result.rows[0];
          return ok(res, { job: { id: j.id, jobType: j.job_type, status: j.status }, message: `${jt || 'reminder'} executed` });
        }

        return notFound(res);
      }

      default: {
        // Catch-all for ratings and connections aliases
        const eid = parseInt(resource);
        if (req.method === 'GET' && isNaN(eid) && id === 'event' && sub) {
          const eV = parseInt(sub);
          if (!isNaN(eV)) {
            if (resource === 'ratings' && sub === 'user') {
              const r = await query('SELECT * FROM event_ratings WHERE event_id = $1 AND user_id = $2 LIMIT 1', [eV, accountId]);
              if (r.rows.length === 0) return ok(res, { rating: null });
              return ok(res, { rating: r.rows[0].rating, review: r.rows[0].review || '' });
            }
            if (resource === 'ratings' && sub === 'suggestions') {
              return ok(res, { suggestions: ['Connect with people who share your interests', 'Join the event community group', 'Check out similar upcoming events'] });
            }
          }
        }
        if (req.method === 'GET' && !isNaN(eid) && !id && !sub) {
          if (resource === 'connections') {
            const result = await query('SELECT * FROM event_connections WHERE event_id = $1 ORDER BY created_at DESC', [eid]);
            return ok(res, { connections: result.rows.map((c: any) => ({ id: c.id, eventId: String(c.event_id), requesterId: String(c.requester_id), targetId: String(c.target_id), status: c.status, source: c.source || 'manual', createdAt: c.created_at, updatedAt: c.updated_at })) });
          }
          if (resource === 'ratings') {
            return ok(res, { ratings: [] });
          }
        }
        if (req.method === 'POST' && !isNaN(eid) && !id && !sub) {
          if (resource === 'ratings') {
            const { rating: rt, review: rv } = req.body || {};
            if (!rt) return bad(res, 'rating required');
            const existing = await query('SELECT id FROM event_ratings WHERE event_id = $1 AND user_id = $2', [eid, accountId]);
            if (existing.rows.length > 0) return bad(res, 'Already rated');
            const r = await query('INSERT INTO event_ratings (event_id, user_id, rating, review) VALUES ($1, $2, $3, $4) RETURNING *', [eid, accountId, Math.min(5, Math.max(1, rt)), rv || '']);
            return created(res, { id: r.rows[0].id, eventId: String(r.rows[0].event_id), userId: String(r.rows[0].user_id), rating: r.rows[0].rating, review: r.rows[0].review, createdAt: r.rows[0].created_at });
          }
        }
        if (req.method === 'POST' && !isNaN(eid) && id === 'request' && !sub) {
          if (resource === 'connections') {
            const { source } = req.body || {};
            const result = await query(
              "INSERT INTO event_connections (event_id, requester_id, target_id, source, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *",
              [eid, accountId, parseInt(id), source || 'manual']
            );
            return created(res, { id: result.rows[0].id, eventId: String(result.rows[0].event_id), requesterId: String(result.rows[0].requester_id), targetId: String(result.rows[0].target_id), status: result.rows[0].status });
          }
        }
        if (req.method === 'PUT' && !isNaN(eid) && id === 'respond' && !sub) {
          if (resource === 'connections') {
            const { status: newStatus, connectionId } = req.body || {};
            const result = await query(
              "UPDATE event_connections SET status = $1, updated_at = NOW() WHERE id::text = $2 AND target_id = $3 RETURNING *",
              [newStatus || 'accepted', connectionId, accountId]
            );
            if (result.rows.length === 0) return notFound(res);
            return ok(res, { message: 'Connection updated' });
          }
        }
        return notFound(res);
      }
    }
  } catch (e: any) {
    return serverError(res, e.message);
  }
}
