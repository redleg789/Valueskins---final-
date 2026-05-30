import type { NextApiRequest, NextApiResponse } from 'next';
import { query, transaction } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';
import {
  EVENT_DB_COLUMNS,
  formToDbColumns,
  dbRowToForm,
  dbRowToMockEvent,
  parseJsonArray,
  buildInsertQuery,
  buildUpdateQuery,
} from '@/lib/db-mapping';

function ok(res: NextApiResponse, data: any) {
  return res.status(200).json(data);
}
function created(res: NextApiResponse, data: any) {
  return res.status(201).json(data);
}
function noContent(res: NextApiResponse) {
  return res.status(204).end();
}
function bad(res: NextApiResponse, msg: string) {
  return res.status(400).json({ error: msg });
}
function notFound(res: NextApiResponse) {
  return res.status(404).json({ error: 'Not found' });
}
function unauthorized(res: NextApiResponse) {
  return res.status(401).json({ error: 'Unauthorized' });
}

const userIdCache = new Map<string, number>();

async function getUserId(req: NextApiRequest): Promise<number | null> {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/valueskins_session=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  if (userIdCache.has(token)) return userIdCache.get(token)!;
  const uid = await getSessionUserId(cookie);
  if (uid) userIdCache.set(token, uid);
  return uid;
}

async function getOrCreateDevUser(): Promise<number> {
  const existing = await query('SELECT id FROM users WHERE instagram_user_id = $1', ['dev-user']);
  if (existing.rows.length > 0) return existing.rows[0].id;
  const created = await query(
    `INSERT INTO users (instagram_user_id, username, display_name, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    ['dev-user', 'dev', 'Dev User', 'creator']
  );
  return created.rows[0].id;
}

async function fetchTicketTiers(eventId: number) {
  const result = await query(
    'SELECT id, name, tier_type, price_cents, quantity, remaining, description, benefits FROM event_ticket_tiers WHERE event_id = $1 ORDER BY price_cents',
    [eventId]
  );
  return result.rows.map((r: any) => ({
    id: String(r.id),
    name: r.name,
    type: r.tier_type,
    priceCents: r.price_cents,
    quantity: r.quantity,
    remaining: r.remaining > 0 ? r.remaining : (r.quantity > 0 ? r.quantity : r.remaining),
    description: r.description || '',
    benefits: parseJsonArray(r.benefits),
  }));
}

async function fetchScheduleItems(eventId: number) {
  const result = await query(
    'SELECT id, time_label, title, description FROM event_schedule_items WHERE event_id = $1 ORDER BY sort_order',
    [eventId]
  );
  return result.rows.map((r: any) => ({
    id: String(r.id),
    time: r.time_label,
    title: r.title,
    description: r.description || '',
  }));
}

async function fetchTableSections(eventId: number) {
  const result = await query(
    'SELECT id, name, section_type, capacity, price_cents, description, sort_order, color FROM table_sections WHERE event_id = $1 ORDER BY sort_order',
    [eventId]
  );
  return result.rows.map((r: any) => ({
    id: String(r.id),
    name: r.name,
    sectionType: r.section_type,
    capacity: r.capacity,
    priceCents: r.price_cents || 0,
    description: r.description || '',
    color: r.color || '#38bdf8',
  }));
}

async function fetchFeaturedPeople(eventId: number) {
  const result = await query(
    `SELECT
      efp.id,
      efp.tagged_user_id as user_id,
      efp.tag_type,
      efp.display_role,
      efp.descriptor,
      efp.tag_metadata,
      u.display_name,
      u.username,
      us.valueskin_code,
      u.avatar_url
     FROM event_featured_people efp
     JOIN users u ON efp.tagged_user_id = u.id
     LEFT JOIN user_stickers us ON u.id = us.user_id AND us.is_active = TRUE
     WHERE efp.event_id = $1 AND efp.deleted_at IS NULL
     ORDER BY efp.sort_order`,
    [eventId]
  );

  return result.rows.map((r: any) => {
    const metadata = typeof r.tag_metadata === 'string' ? JSON.parse(r.tag_metadata || '{}') : (r.tag_metadata || {});
    return {
      id: String(r.id),
      tag: {
        id: String(r.id),
        personaId: 0,
        userId: r.user_id,
        username: r.username,
        name: r.display_name,
        role: r.tag_type,
        handle: metadata.valueskinCode || r.valueskin_code || '',
        avatarUrl: r.avatar_url,
        verified: false,
        followersCount: 0,
        descriptor: r.descriptor || '',
        hasValueSkin: !!r.valueskin_code,
        valueskins: r.valueskin_code ? [r.valueskin_code] : [],
        approvalState: 'approved',
        isPublic: true,
        autoApprove: true,
      },
      featuredRole: r.display_role,
      sortOrder: 0,
    };
  });
}

async function fetchFaqEntries(eventId: number) {
  const result = await query(
    'SELECT id, question, answer FROM event_faqs WHERE event_id = $1 ORDER BY sort_order',
    [eventId]
  );
  return result.rows.map((r: any) => ({
    id: String(r.id),
    question: r.question,
    answer: r.answer,
  }));
}

async function fetchPromoters(eventId: number) {
  const result = await query(
    `SELECT ep.id, ep.promoter_user_id, u.display_name, u.username, ep.commission_type, ep.commission_value, ep.promo_code, ep.created_at
     FROM event_promoters ep
     JOIN users u ON ep.promoter_user_id = u.id
     WHERE ep.event_id = $1 AND ep.deleted_at IS NULL
     ORDER BY ep.created_at DESC`,
    [eventId]
  );
  return result.rows.map((r: any) => ({
    id: String(r.id),
    promoterId: String(r.promoter_user_id),
    name: r.display_name,
    username: r.username,
    commissionType: r.commission_type,
    commissionValue: parseFloat(r.commission_value || 0),
    promoCode: r.promo_code,
    createdAt: r.created_at,
  }));
}

async function fetchPromoterAnalytics(eventId: number, promoterId?: number) {
  const baseQuery = `
    SELECT
      ep.id as promoter_id,
      ep.promoter_user_id,
      u.display_name,
      u.username,
      ep.commission_type,
      ep.commission_value,
      ep.promo_code,
      COUNT(ea.id) as tickets_sold,
      COALESCE(SUM(CASE WHEN ett.price_cents > 0 THEN ett.price_cents ELSE 0 END), 0) as total_revenue_cents
    FROM event_promoters ep
    JOIN users u ON ep.promoter_user_id = u.id
    LEFT JOIN event_applications ea ON ea.promoter_user_id = ep.promoter_user_id AND ea.event_id = $1
    LEFT JOIN event_ticket_tiers ett ON ea.event_id = ett.event_id
    WHERE ep.event_id = $1 AND ep.deleted_at IS NULL
  `;

  const params: any[] = [eventId];
  let fullQuery = baseQuery;

  if (promoterId) {
    fullQuery += ` AND ep.promoter_user_id = $2`;
    params.push(promoterId);
  }

  fullQuery += ` GROUP BY ep.id, ep.promoter_user_id, u.display_name, u.username, ep.commission_type, ep.commission_value, ep.promo_code
                ORDER BY tickets_sold DESC`;

  const result = await query(fullQuery, params);

  return result.rows.map((r: any) => {
    const totalRevenueCents = parseInt(r.total_revenue_cents || 0);
    let commissionCents = 0;

    if (r.commission_type === 'percentage') {
      commissionCents = Math.floor(totalRevenueCents * (parseFloat(r.commission_value) / 100));
    } else {
      commissionCents = parseInt(r.commission_value || 0) * 100 * parseInt(r.tickets_sold || 0);
    }

    return {
      promoterId: String(r.promoter_user_id),
      name: r.display_name,
      username: r.username,
      promoCode: r.promo_code,
      ticketsSold: parseInt(r.tickets_sold || 0),
      totalRevenueCents,
      commissionType: r.commission_type,
      commissionValue: parseFloat(r.commission_value),
      estimatedCommissionCents: commissionCents,
    };
  });
}

async function insertTicketTiers(eventId: number, tiers: any[]) {
  if (!tiers || tiers.length === 0) return;
  for (const tier of tiers) {
    const quantity = tier.quantity ?? tier.remaining ?? 0;
    const remaining = tier.remaining ?? tier.quantity ?? quantity;
    const { text, values } = buildInsertQuery('event_ticket_tiers', {
      event_id: eventId,
      name: tier.name || 'General',
      tier_type: tier.type || 'general',
      price_cents: tier.priceCents || 0,
      quantity,
      remaining,
      description: tier.description || null,
      benefits: JSON.stringify(tier.benefits || []),
      sale_start: tier.saleStartDate || null,
      sale_end: tier.saleEndDate || null,
    });
    await query(text, values);
  }
}

async function insertScheduleItems(eventId: number, items: any[]) {
  if (!items || items.length === 0) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    await query(
      'INSERT INTO event_schedule_items (event_id, time_label, title, description, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [eventId, item.time || '', item.title || '', item.description || null, i]
    );
  }
}

async function insertTableSections(eventId: number, sections: any[]) {
  if (!sections || sections.length === 0) return;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    await query(
      'INSERT INTO table_sections (event_id, name, section_type, capacity, price_cents, description, sort_order, color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [eventId, s.name || 'Section', s.sectionType || 'general', s.capacity || 0, s.priceCents || 0, s.description || null, i, s.color || '#38bdf8']
    );
  }
}

async function insertFeaturedPeople(eventId: number, featuredPeople: any[], hostUserId: number) {
  if (!featuredPeople || featuredPeople.length === 0) return;
  for (let i = 0; i < featuredPeople.length; i++) {
    const person = featuredPeople[i];
    if (!person.tag || !person.tag.userId) continue;

    try {
      const personaResult = await query(
        'SELECT id FROM personas WHERE owner_user_id = $1',
        [person.tag.userId]
      );
      if (personaResult.rows.length === 0) {
        console.warn(`No persona found for user ${person.tag.userId}`);
        continue;
      }

      const personaId = personaResult.rows[0].id;
      await query(
        `INSERT INTO event_featured_people
         (event_id, tagged_user_id, tagged_persona_id, tagged_by_user_id, tag_type, display_role, descriptor, approval_state, is_public, auto_approve, sort_order, tag_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          eventId,
          person.tag.userId,
          personaId,
          hostUserId,
          person.tag.role || person.featuredRole || 'Guest',
          person.featuredRole || person.tag.role || 'Guest',
          person.tag.descriptor || null,
          'approved',
          true,
          true,
          i,
          JSON.stringify({ valueskinCode: person.tag.handle || '' })
        ]
      );
    } catch (err: any) {
      console.warn(`Failed to insert featured person for user ${person.tag.userId}:`, err.message);
    }
  }
}

async function getHostUsername(userId: number): Promise<string> {
  const result = await query('SELECT display_name, username FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) return 'Host';
  return result.rows[0].display_name || result.rows[0].username || 'Host';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path, ...queryParams } = req.query;
  const pathStr = Array.isArray(path) ? path.join('/') : (path ?? '');
  console.log(`[events API] ${req.method} ${pathStr}`);
  const userId = await getUserId(req);
  console.log(`[events API] userId:`, userId);

  if (!userId) {
    return unauthorized(res);
  }

  try {
    await getOrCreateDevUser();
  } catch (e: any) {
    return res.status(500).json({ error: 'DB init failed', detail: e.message });
  }

  const parts = pathStr.split('/');
  const eventIdStr = parts[0];
  const subResource = parts[1];
  const subId = parts[2];
  const action = parts[3];

  // ── GET /api/events ── list with search/filter
  if (req.method === 'GET' && !pathStr) {
    try {
      const { search, category, city, dateFrom, dateTo, sort } = queryParams as Record<string, string>;

      let sql = `SELECT ${EVENT_DB_COLUMNS} FROM events WHERE visibility_status = 'active' AND is_publicly_listed = true`;
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        sql += ` AND (title ILIKE $${paramIndex} OR one_line_summary ILIKE $${paramIndex} OR venue_name ILIKE $${paramIndex} OR location ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      if (category) {
        sql += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }
      if (city) {
        sql += ` AND (location ILIKE $${paramIndex} OR full_address ILIKE $${paramIndex})`;
        params.push(`%${city}%`);
        paramIndex++;
      }
      if (dateFrom) {
        sql += ` AND start_time >= $${paramIndex}`;
        params.push(dateFrom);
        paramIndex++;
      }
      if (dateTo) {
        sql += ` AND start_time <= $${paramIndex}`;
        params.push(dateTo);
        paramIndex++;
      }

      if (sort === 'date_asc') {
        sql += ' ORDER BY start_time ASC';
      } else if (sort === 'date_desc') {
        sql += ' ORDER BY start_time DESC';
      } else if (sort === 'newest') {
        sql += ' ORDER BY created_at DESC';
      } else {
        sql += ' ORDER BY created_at DESC';
      }

      const result = await query(sql, params);
      const responseEvents = [];
      for (const row of result.rows) {
        const form = dbRowToForm(row);
        form.ticketTiers = await fetchTicketTiers(row.id);
        form.schedule = await fetchScheduleItems(row.id);
        form.tableSections = await fetchTableSections(row.id);
        form.faqEntries = await fetchFaqEntries(row.id);
        const hostname = await getHostUsername(row.host_user_id);
        responseEvents.push(dbRowToMockEvent({ ...row, host_username: hostname }, form));
      }

      return ok(res, { events: responseEvents, total: responseEvents.length });
    } catch (e: any) {
      return res.status(500).json({ error: 'Query failed', detail: e.message });
    }
  }

  // ── GET /api/events/hosted ── my created events
  if (req.method === 'GET' && pathStr === 'hosted') {
    console.log('GET /api/events/hosted - userId:', userId, 'pathStr:', pathStr);
    try {
      const result = await query(
        `SELECT ${EVENT_DB_COLUMNS} FROM events WHERE host_user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      const responseEvents = [];
      for (const row of result.rows) {
        const form = dbRowToForm(row);
        form.ticketTiers = await fetchTicketTiers(row.id);
        form.schedule = await fetchScheduleItems(row.id);
        form.tableSections = await fetchTableSections(row.id);
        form.faqEntries = await fetchFaqEntries(row.id);
        form.featuredPeople = await fetchFeaturedPeople(row.id);
        const hostname = await getHostUsername(row.host_user_id);
        responseEvents.push(dbRowToMockEvent({ ...row, host_username: hostname }, form));
      }
      return ok(res, { events: responseEvents });
    } catch (e: any) {
      console.error('GET /api/events/hosted error:', e);
      return res.status(500).json({ error: 'Query failed', detail: e.message });
    }
  }

  // ── GET /api/events/applied ── events I've applied to
  if (req.method === 'GET' && pathStr === 'applied') {
    console.log('GET /api/events/applied - userId:', userId);
    try {
      const apps = await query(
        'SELECT event_id, status, created_at FROM event_applications WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      const eventIds = apps.rows.map((r: any) => r.event_id);
      console.log('Applied events count:', eventIds.length);
      if (eventIds.length === 0) return ok(res, { events: [], applications: [] });

      const result = await query(
        `SELECT ${EVENT_DB_COLUMNS} FROM events WHERE id = ANY($1::bigint[]) ORDER BY created_at DESC`,
        [eventIds]
      );
      const responseEvents = [];
      for (const row of result.rows) {
        const form = dbRowToForm(row);
        form.ticketTiers = await fetchTicketTiers(row.id);
        form.schedule = await fetchScheduleItems(row.id);
        form.tableSections = await fetchTableSections(row.id);
        form.faqEntries = await fetchFaqEntries(row.id);
        form.featuredPeople = await fetchFeaturedPeople(row.id);
        const hostname = await getHostUsername(row.host_user_id);
        responseEvents.push(dbRowToMockEvent({ ...row, host_username: hostname }, form));
      }
      return ok(res, {
        events: responseEvents,
        applications: apps.rows.map((a: any) => ({
          id: String(a.event_id),
          eventId: String(a.event_id),
          userId: String(userId),
          status: a.status,
          createdAt: a.created_at,
        })),
      });
    } catch (e: any) {
      return res.status(500).json({ error: 'Query failed', detail: e.message });
    }
  }

  // ── GET /api/events/featured ── events where I'm tagged as featured
  if (req.method === 'GET' && pathStr === 'featured') {
    console.log('GET /api/events/featured - userId:', userId);
    try {
      const tagged = await query(
        'SELECT event_id FROM event_featured_people WHERE tagged_user_id = $1 AND deleted_at IS NULL',
        [userId]
      );
      const eventIds = tagged.rows.map((r: any) => r.event_id);
      console.log('Featured events count:', eventIds.length);
      if (eventIds.length === 0) return ok(res, { events: [] });

      const result = await query(
        `SELECT ${EVENT_DB_COLUMNS} FROM events WHERE id = ANY($1::bigint[]) ORDER BY created_at DESC`,
        [eventIds]
      );
      const responseEvents = [];
      for (const row of result.rows) {
        const form = dbRowToForm(row);
        form.ticketTiers = await fetchTicketTiers(row.id);
        form.schedule = await fetchScheduleItems(row.id);
        form.tableSections = await fetchTableSections(row.id);
        form.faqEntries = await fetchFaqEntries(row.id);
        form.featuredPeople = await fetchFeaturedPeople(row.id);
        const hostname = await getHostUsername(row.host_user_id);
        responseEvents.push(dbRowToMockEvent({ ...row, host_username: hostname }, form));
      }
      return ok(res, { events: responseEvents });
    } catch (e: any) {
      console.error('GET /api/events/featured error:', e);
      return res.status(500).json({ error: 'Query failed', detail: e.message });
    }
  }

  // ── POST /api/events ── create
  if (req.method === 'POST' && !pathStr) {
    const { form } = req.body;
    if (!form) return bad(res, 'Missing event form data');

    try {
      const dbColumns = formToDbColumns(form, userId);
      delete dbColumns.visibility_status;

      const insertResult = await query(
        `INSERT INTO events (${Object.keys(dbColumns).map((k, i) => `"${k}"`).join(', ')})
         VALUES (${Object.keys(dbColumns).map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING ${EVENT_DB_COLUMNS}`,
        Object.values(dbColumns)
      );

      const eventRow = insertResult.rows[0];

      if (form.ticketTiers && form.ticketTiers.length > 0) {
        await insertTicketTiers(eventRow.id, form.ticketTiers);
      } else if (form.ticketingModel === 'paid') {
        const qty = form.unlimitedTickets ? 999999 : Math.max(form.maxAttendees || 100, 1);
        await insertTicketTiers(eventRow.id, [{
          name: 'General Admission',
          type: 'general',
          priceCents: dbColumns.ticket_price_cents || 0,
          quantity: qty,
          remaining: qty,
          description: '',
          benefits: [],
        }]);
      }
      if (form.schedule && form.schedule.length > 0) {
        await insertScheduleItems(eventRow.id, form.schedule);
      }
      if (form.tableSections && form.tableSections.length > 0) {
        await insertTableSections(eventRow.id, form.tableSections);
      }
      if (form.featuredPeople && form.featuredPeople.length > 0) {
        await insertFeaturedPeople(eventRow.id, form.featuredPeople, eventRow.host_user_id);
      }

      const fullForm = dbRowToForm(eventRow);
      fullForm.ticketTiers = await fetchTicketTiers(eventRow.id);
      fullForm.schedule = await fetchScheduleItems(eventRow.id);
      fullForm.tableSections = await fetchTableSections(eventRow.id);
      fullForm.featuredPeople = await fetchFeaturedPeople(eventRow.id);

      const hostname = await getHostUsername(eventRow.host_user_id);
      const mockEvent = dbRowToMockEvent({ ...eventRow, host_username: hostname }, fullForm);

      return created(res, mockEvent);
    } catch (e: any) {
      console.error('Event creation error:', e);
      return res.status(500).json({ error: 'Create failed', detail: e.message || String(e) });
    }
  }

  // ── Handlers for a specific event ──
  if (eventIdStr && !subResource) {
    const eventId = parseInt(eventIdStr, 10);
    if (isNaN(eventId)) return notFound(res);

    try {
      // GET /api/events/:id
      if (req.method === 'GET') {
        const result = await query(
          `SELECT ${EVENT_DB_COLUMNS} FROM events WHERE id = $1`,
          [eventId]
        );
        if (result.rows.length === 0) return notFound(res);

        const row = result.rows[0];
        const form = dbRowToForm(row);
        form.ticketTiers = await fetchTicketTiers(row.id);
        form.schedule = await fetchScheduleItems(row.id);
        form.tableSections = await fetchTableSections(row.id);
        form.faqEntries = await fetchFaqEntries(row.id);
        form.featuredPeople = await fetchFeaturedPeople(row.id);

        const hostname = await getHostUsername(row.host_user_id);
        return ok(res, dbRowToMockEvent({ ...row, host_username: hostname }, form));
      }

      // PUT /api/events/:id — update
      if (req.method === 'PUT') {
        const { form } = req.body;
        if (!form) return bad(res, 'Missing form data');

        const dbColumns = formToDbColumns(form, userId);
        delete dbColumns.visibility_status;
        delete dbColumns.host_user_id;

        const updateResult = await query(
          `UPDATE events SET ${Object.keys(dbColumns).map((k, i) => `"${k}" = $${i + 1}`).join(', ')}, updated_at = NOW()
           WHERE id = $${Object.keys(dbColumns).length + 1} AND host_user_id = $${Object.keys(dbColumns).length + 2}
           RETURNING ${EVENT_DB_COLUMNS}`,
          [...Object.values(dbColumns), eventId, userId]
        );

        if (updateResult.rows.length === 0) return notFound(res);

        await query('DELETE FROM event_ticket_tiers WHERE event_id = $1', [eventId]);
        await query('DELETE FROM event_schedule_items WHERE event_id = $1', [eventId]);
        await query('DELETE FROM table_sections WHERE event_id = $1', [eventId]);
        await query('DELETE FROM event_featured_people WHERE event_id = $1', [eventId]);

        if (form.ticketTiers && form.ticketTiers.length > 0) {
          await insertTicketTiers(eventId, form.ticketTiers);
        } else if (form.ticketingModel === 'paid') {
          const qty = form.unlimitedTickets ? 999999 : Math.max(form.maxAttendees || 100, 1);
          await insertTicketTiers(eventId, [{
            name: 'General Admission',
            type: 'general',
            priceCents: dbColumns.ticket_price_cents || 0,
            quantity: qty,
            remaining: qty,
            description: '',
            benefits: [],
          }]);
        }
        if (form.schedule && form.schedule.length > 0) {
          await insertScheduleItems(eventId, form.schedule);
        }
        if (form.tableSections && form.tableSections.length > 0) {
          await insertTableSections(eventId, form.tableSections);
        }
        if (form.featuredPeople && form.featuredPeople.length > 0) {
          await insertFeaturedPeople(eventId, form.featuredPeople, userId);
        }

        const row = updateResult.rows[0];
        const fullForm = dbRowToForm(row);
        fullForm.ticketTiers = await fetchTicketTiers(row.id);
        fullForm.schedule = await fetchScheduleItems(row.id);
        fullForm.tableSections = await fetchTableSections(row.id);
        fullForm.faqEntries = await fetchFaqEntries(row.id);
        fullForm.featuredPeople = await fetchFeaturedPeople(row.id);

        const hostname = await getHostUsername(row.host_user_id);
        return ok(res, dbRowToMockEvent({ ...row, host_username: hostname }, fullForm));
      }

      // DELETE /api/events/:id — cancel
      if (req.method === 'DELETE') {
        const cancelResult = await query(
          'UPDATE events SET visibility_status = $1, updated_at = NOW() WHERE id = $2 AND host_user_id = $3',
          ['archived', eventId, userId]
        );
        if (cancelResult.rowCount === 0) return notFound(res);
        return ok(res, { message: 'Event cancelled' });
      }
    } catch (e: any) {
      return res.status(500).json({ error: 'Operation failed', detail: e.message });
    }
  }

  // ── Event sub-resources ──

  // POST /api/events/:id/applications — submit application
  if ((req.method === 'POST') && eventIdStr && (subResource === 'applications' || subResource === 'apply') && !subId) {
    const eventId = parseInt(eventIdStr, 10);
    if (isNaN(eventId)) return notFound(res);

    const { reason } = req.body || {};

    try {
      const eventCheck = await query(
        'SELECT id, host_user_id, entry_approval_required FROM events WHERE id = $1',
        [eventId]
      );
      if (eventCheck.rows.length === 0) return notFound(res);

      if (Number(eventCheck.rows[0].host_user_id) === userId) {
        await query(
          'DELETE FROM event_applications WHERE event_id = $1 AND user_id = $2',
          [eventId, userId]
        );
        return bad(res, 'Hosts cannot register for their own event');
      }

      const taggedCheck = await query(
        'SELECT id FROM event_featured_people WHERE event_id = $1 AND tagged_user_id = $2 AND deleted_at IS NULL',
        [eventId, userId]
      );
      if (taggedCheck.rows.length > 0) {
        return bad(res, 'You cannot purchase a ticket for this event because you are tagged as a featured creator and are part of the event team');
      }

      const needsReview = !!eventCheck.rows[0].entry_approval_required;
      const initialStatus = needsReview ? 'pending' : 'approved';

      const existing = await query(
        'SELECT id, status, applicant_name, applicant_email, reason, created_at FROM event_applications WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );
      if (existing.rows.length > 0) {
        const app = existing.rows[0];
        return ok(res, {
          requiresReview: needsReview,
          alreadyRegistered: true,
          application: {
            id: String(app.id),
            eventId: String(eventId),
            userId: String(userId),
            applicantName: app.applicant_name,
            applicantEmail: app.applicant_email,
            reason: app.reason || '',
            status: app.status,
            createdAt: app.created_at,
          },
        });
      }

      const userResult = await query(
        `SELECT u.display_name, u.username, u.instagram_user_id, a.email AS account_email
         FROM users u
         LEFT JOIN accounts a ON u.account_id = a.id
         WHERE u.id = $1`,
        [userId]
      );
      if (userResult.rows.length === 0) return unauthorized(res);

      const row = userResult.rows[0];
      const displayName = (row.display_name || row.username || 'User').trim();
      const instagramId = String(row.instagram_user_id || '');
      const email =
        (row.account_email && String(row.account_email).includes('@')
          ? row.account_email
          : instagramId.includes('@')
            ? instagramId
            : null);

      if (!email) {
        return bad(res, 'Add an email to your account before registering');
      }

      const nameFromBody = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const emailFromBody = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const promoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim() : '';
      const applicantName = nameFromBody || displayName;
      const applicantEmail = emailFromBody || email;

      let promoterId = null;
      if (promoCode) {
        const promoCheck = await query(
          'SELECT promoter_user_id FROM event_promoters WHERE event_id = $1 AND promo_code = $2 AND deleted_at IS NULL',
          [eventId, promoCode]
        );
        if (promoCheck.rows.length > 0) {
          promoterId = promoCheck.rows[0].promoter_user_id;
        }
      }

      const appResult = await query(
        `INSERT INTO event_applications (event_id, user_id, applicant_name, applicant_email, reason, status, promoter_user_id, promo_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, status, created_at`,
        [eventId, userId, applicantName, applicantEmail, reason || '', initialStatus, promoterId, promoCode]
      );

      const app = appResult.rows[0];
      return created(res, {
        requiresReview: needsReview,
        application: {
          id: String(app.id),
          eventId: String(eventId),
          userId: String(userId),
          applicantName,
          applicantEmail,
          reason: reason || '',
          status: app.status,
          createdAt: app.created_at,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: 'Application failed', detail: e.message });
    }
  }

  // GET /api/events/:id/promoters — list promoters
  if (req.method === 'GET' && eventIdStr && subResource === 'promoters' && !subId) {
    const eventId = parseInt(eventIdStr, 10);
    if (isNaN(eventId)) return notFound(res);
    try {
      const promoters = await fetchPromoters(eventId);
      return ok(res, { promoters });
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch promoters', detail: e.message });
    }
  }

  // GET /api/events/:id/promoters/analytics — promoter analytics
  if (req.method === 'GET' && eventIdStr && subResource === 'promoters' && subId === 'analytics') {
    const eventId = parseInt(eventIdStr, 10);
    if (isNaN(eventId)) return notFound(res);
    try {
      const eventCheck = await query('SELECT host_user_id FROM events WHERE id = $1', [eventId]);
      if (eventCheck.rows.length === 0 || Number(eventCheck.rows[0].host_user_id) !== userId) {
        return unauthorized(res);
      }
      const analytics = await fetchPromoterAnalytics(eventId);
      return ok(res, { analytics });
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch analytics', detail: e.message });
    }
  }

  // GET /api/promoter-earnings — my earnings as promoter
  if (req.method === 'GET' && pathStr === 'promoter-earnings') {
    try {
      const result = await query(
        `SELECT
          e.id as event_id,
          e.form->'eventName' as event_name,
          ep.commission_type,
          ep.commission_value,
          COUNT(ea.id) as tickets_sold,
          COALESCE(SUM(CASE WHEN ett.price_cents > 0 THEN ett.price_cents ELSE 0 END), 0) as total_revenue_cents
        FROM event_promoters ep
        JOIN events e ON ep.event_id = e.id
        LEFT JOIN event_applications ea ON ea.promoter_user_id = ep.promoter_user_id AND ea.event_id = e.id
        LEFT JOIN event_ticket_tiers ett ON ea.event_id = ett.event_id
        WHERE ep.promoter_user_id = $1 AND ep.deleted_at IS NULL
        GROUP BY e.id, ep.commission_type, ep.commission_value`,
        [userId]
      );

      const earnings = result.rows.map((r: any) => {
        const totalRevenueCents = parseInt(r.total_revenue_cents || 0);
        let commissionCents = 0;
        if (r.commission_type === 'percentage') {
          commissionCents = Math.floor(totalRevenueCents * (parseFloat(r.commission_value) / 100));
        } else {
          commissionCents = parseInt(r.commission_value || 0) * 100 * parseInt(r.tickets_sold || 0);
        }
        return {
          eventId: String(r.event_id),
          eventName: r.event_name,
          ticketsSold: parseInt(r.tickets_sold || 0),
          totalRevenueCents,
          commissionType: r.commission_type,
          commissionValue: parseFloat(r.commission_value),
          estimatedCommissionCents: commissionCents,
        };
      });

      const totalEarnings = earnings.reduce((sum, e) => sum + e.estimatedCommissionCents, 0);
      return ok(res, { earnings, totalEarningsCents: totalEarnings });
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch earnings', detail: e.message });
    }
  }

  // POST /api/events/:id/promoters — add promoter
  if (req.method === 'POST' && eventIdStr && subResource === 'promoters' && !subId) {
    const eventId = parseInt(eventIdStr, 10);
    if (isNaN(eventId)) return notFound(res);
    const { promoterUsername, commissionType, commissionValue } = req.body;
    if (!promoterUsername || !commissionType || commissionValue === undefined) {
      return bad(res, 'Missing promoter details');
    }
    try {
      const eventCheck = await query('SELECT host_user_id FROM events WHERE id = $1', [eventId]);
      if (eventCheck.rows.length === 0 || Number(eventCheck.rows[0].host_user_id) !== userId) {
        return unauthorized(res);
      }
      const promoterCheck = await query('SELECT id FROM users WHERE username = $1', [promoterUsername]);
      if (promoterCheck.rows.length === 0) return bad(res, 'Promoter not found');
      const promoterId = promoterCheck.rows[0].id;
      const promoCode = `PROMO_${promoterUsername.toUpperCase()}_${Date.now()}`.substring(0, 50);
      await query(
        `INSERT INTO event_promoters (event_id, promoter_user_id, commission_type, commission_value, promo_code)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventId, promoterId, commissionType, commissionValue, promoCode]
      );
      const promoters = await fetchPromoters(eventId);
      return created(res, { promoters });
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to add promoter', detail: e.message });
    }
  }

  // DELETE /api/events/:id/promoters/:subId — remove promoter
  if (req.method === 'DELETE' && eventIdStr && subResource === 'promoters' && subId) {
    const eventId = parseInt(eventIdStr, 10);
    const promoterId = parseInt(subId, 10);
    if (isNaN(eventId) || isNaN(promoterId)) return notFound(res);
    try {
      const eventCheck = await query('SELECT host_user_id FROM events WHERE id = $1', [eventId]);
      if (eventCheck.rows.length === 0 || Number(eventCheck.rows[0].host_user_id) !== userId) {
        return unauthorized(res);
      }
      await query(
        'UPDATE event_promoters SET deleted_at = NOW() WHERE id = $1 AND event_id = $2',
        [promoterId, eventId]
      );
      const promoters = await fetchPromoters(eventId);
      return ok(res, { promoters });
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to remove promoter', detail: e.message });
    }
  }

  // GET /api/events/:id/applications — list applications (host only)
  if (req.method === 'GET' && eventIdStr && subResource === 'applications' && !subId) {
    const eventId = parseInt(eventIdStr, 10);
    if (isNaN(eventId)) return notFound(res);

    try {
      const eventCheck = await query('SELECT id, host_user_id FROM events WHERE id = $1', [eventId]);
      if (eventCheck.rows.length === 0) return notFound(res);
      const hostUserId = Number(eventCheck.rows[0].host_user_id);

      await query(
        'DELETE FROM event_applications WHERE event_id = $1 AND user_id = $2',
        [eventId, hostUserId]
      );

      const apps = await query(
        'SELECT id, event_id, user_id, applicant_name, applicant_email, reason, status, created_at FROM event_applications WHERE event_id = $1 AND (user_id IS NULL OR user_id <> $2) ORDER BY created_at DESC',
        [eventId, hostUserId]
      );

      return ok(res, {
        applications: apps.rows.map((a: any) => ({
          id: String(a.id),
          eventId: String(a.event_id),
          userId: a.user_id ? String(a.user_id) : null,
          applicantName: a.applicant_name,
          applicantEmail: a.applicant_email,
          reason: a.reason || '',
          status: a.status,
          createdAt: a.created_at,
        })),
      });
    } catch (e: any) {
      return res.status(500).json({ error: 'Query failed', detail: e.message });
    }
  }

  // POST /api/events/:id/applications/:appId/approve
  if (req.method === 'POST' && eventIdStr && subResource === 'applications' && subId && action === 'approve') {
    const eventId = parseInt(eventIdStr, 10);
    const appId = parseInt(subId, 10);
    if (isNaN(eventId) || isNaN(appId)) return notFound(res);

    try {
      const result = await query(
        `UPDATE event_applications SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
         WHERE id = $2 AND event_id = $3 AND status = 'pending' RETURNING *`,
        [userId, appId, eventId]
      );
      if (result.rows.length === 0) return notFound(res);
      return ok(res, { application: { id: String(appId), status: 'approved' } });
    } catch (e: any) {
      return res.status(500).json({ error: 'Approve failed', detail: e.message });
    }
  }

  // POST /api/events/:id/applications/:appId/reject
  if (req.method === 'POST' && eventIdStr && subResource === 'applications' && subId && action === 'reject') {
    const eventId = parseInt(eventIdStr, 10);
    const appId = parseInt(subId, 10);
    if (isNaN(eventId) || isNaN(appId)) return notFound(res);

    try {
      const result = await query(
        `UPDATE event_applications SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
         WHERE id = $2 AND event_id = $3 AND status = 'pending' RETURNING *`,
        [userId, appId, eventId]
      );
      if (result.rows.length === 0) return notFound(res);
      return ok(res, { application: { id: String(appId), status: 'rejected' } });
    } catch (e: any) {
      return res.status(500).json({ error: 'Reject failed', detail: e.message });
    }
  }

  // GET /api/events/:id/attendees — list attendees
  if (req.method === 'GET' && eventIdStr && subResource === 'attendees') {
    const eventId = parseInt(eventIdStr, 10);
    if (isNaN(eventId)) return notFound(res);

    try {
      const eventCheck = await query('SELECT id FROM events WHERE id = $1', [eventId]);
      if (eventCheck.rows.length === 0) return notFound(res);

      const attResult = await query(
        `SELECT ea.user_id, ea.status, ea.registered_at, u.display_name, u.username, u.avatar_url
         FROM event_attendees ea
         LEFT JOIN users u ON ea.user_id = u.id
         WHERE ea.event_id = $1
         ORDER BY ea.registered_at DESC`,
        [eventId]
      );

      return ok(res, {
        attendees: attResult.rows.map((a: any) => ({
          id: String(a.user_id),
          name: a.display_name || a.username || 'Attendee',
          status: a.status || 'going',
        })),
      });
    } catch (e: any) {
      return res.status(500).json({ error: 'Query failed', detail: e.message });
    }
  }

  return notFound(res);
}
