import { getDb } from './database';
import { nextId } from './ids';
import { listCustomerVehicles, upsertVehicleForCustomer } from './vehicles';

export type Customer = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  phone: string;
  email: string;
  profile_notes: string;
};

export type CustomerNote = {
  id: string;
  customer_id: string;
  created_at: string;
  body: string;
};

export type CustomerListItem = Customer & {
  visit_count: number;
  vrms: string;
};

export { listCustomerVehicles };

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    name: String(row.name),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    profile_notes: String(row.profile_notes ?? ''),
  };
}

export function getCustomer(id: string) {
  const row = getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapCustomer(row) : null;
}

export function listCustomerNotes(customerId: string) {
  const rows = getDb()
    .prepare('SELECT * FROM customer_notes WHERE customer_id = ? ORDER BY created_at DESC')
    .all(customerId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    customer_id: String(row.customer_id),
    created_at: String(row.created_at),
    body: String(row.body),
  })) satisfies CustomerNote[];
}

export function listCustomerBookings(customerId: string) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM bookings
       WHERE customer_id = ?
       ORDER BY date DESC, time DESC`,
    )
    .all(customerId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    date: String(row.date),
    time: String(row.time),
    service: String(row.service),
    status: String(row.status),
    vrm: String(row.vrm),
    vehicle_id: String(row.vehicle_id ?? ''),
    price: Number(row.price),
    notes: String(row.notes ?? ''),
  }));
}

export function findCustomerByPhone(phone: string) {
  if (!phone) return null;
  const row = getDb().prepare('SELECT * FROM customers WHERE phone = ? LIMIT 1').get(phone) as Record<string, unknown> | undefined;
  return row ? mapCustomer(row) : null;
}

function findCustomerByEmail(email: string) {
  if (!email) return null;
  const row = getDb().prepare('SELECT * FROM customers WHERE email = ? LIMIT 1').get(email) as Record<string, unknown> | undefined;
  return row ? mapCustomer(row) : null;
}

function findCustomerByVrm(vrm: string) {
  if (!vrm || vrm === 'BLOCKED') return null;
  const row = getDb()
    .prepare(
      `SELECT c.* FROM customers c
       INNER JOIN customer_vehicle_links l ON l.customer_id = c.id
       INNER JOIN vehicles v ON v.id = l.vehicle_id
       WHERE v.vrm = ?
       LIMIT 1`,
    )
    .get(vrm) as Record<string, unknown> | undefined;
  return row ? mapCustomer(row) : null;
}

export function upsertCustomerFromBooking(input: {
  name: string;
  phone: string;
  email?: string;
  vrm: string;
  vehicle_make_model?: string;
  vehicle_engine?: string;
}) {
  if (!input.vrm || input.vrm === 'BLOCKED') return { customer: null, vehicle: null };

  const existing =
    findCustomerByPhone(input.phone) || findCustomerByEmail(input.email ?? '') || findCustomerByVrm(input.vrm);

  const now = new Date().toISOString();
  const database = getDb();

  if (existing) {
    database
      .prepare(
        `UPDATE customers
         SET name = ?, phone = CASE WHEN length(?) > 0 THEN ? ELSE phone END,
             email = CASE WHEN length(?) > 0 THEN ? ELSE email END,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(input.name, input.phone, input.phone, input.email ?? '', input.email ?? '', now, existing.id);
    const vehicle = upsertVehicleForCustomer(existing.id, input.vrm, input.vehicle_make_model, input.vehicle_engine);
    return { customer: getCustomer(existing.id), vehicle };
  }

  const id = nextId('CUS');
  database
    .prepare(
      `INSERT INTO customers (id, created_at, updated_at, name, phone, email, profile_notes)
       VALUES (?, ?, ?, ?, ?, ?, '')`,
    )
    .run(id, now, now, input.name, input.phone, input.email ?? '');
  const vehicle = upsertVehicleForCustomer(id, input.vrm, input.vehicle_make_model, input.vehicle_engine);
  return { customer: getCustomer(id), vehicle };
}

export function backfillCustomersFromBookings() {
  const rows = getDb()
    .prepare(
      `SELECT * FROM bookings
       WHERE status != 'blocked'
         AND vrm != 'BLOCKED'
         AND (customer_id IS NULL OR length(customer_id) = 0)
       ORDER BY created_at ASC`,
    )
    .all() as Record<string, unknown>[];

  for (const row of rows) {
    const { customer, vehicle } = upsertCustomerFromBooking({
      name: String(row.customer_name),
      phone: String(row.customer_phone),
      email: String(row.customer_email ?? ''),
      vrm: String(row.vrm),
      vehicle_make_model: String(row.vehicle_make_model ?? ''),
      vehicle_engine: String(row.vehicle_engine ?? ''),
    });
    if (customer) {
      getDb()
        .prepare('UPDATE bookings SET customer_id = ?, vehicle_id = ? WHERE id = ?')
        .run(customer.id, vehicle?.id ?? '', String(row.id));
    }
  }
}

export function searchCustomers(query: string) {
  backfillCustomersFromBookings();
  const trimmed = query.trim();
  const like = `%${trimmed.replace(/\s+/g, '%')}%`;
  const compact = `%${trimmed.toUpperCase().replace(/[^A-Z0-9+]/g, '')}%`;
  const vrmsSelect = `COALESCE((SELECT GROUP_CONCAT(v.vrm, ', ') FROM customer_vehicle_links l INNER JOIN vehicles v ON v.id = l.vehicle_id WHERE l.customer_id = c.id), '')`;

  const sql = trimmed
    ? `SELECT c.*,
         (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status != 'blocked') AS visit_count,
         ${vrmsSelect} AS vrms
       FROM customers c
       WHERE c.name LIKE ? COLLATE NOCASE
          OR c.phone LIKE ?
          OR c.email LIKE ? COLLATE NOCASE
          OR c.profile_notes LIKE ? COLLATE NOCASE
          OR EXISTS (
            SELECT 1 FROM customer_vehicle_links l
            INNER JOIN vehicles v ON v.id = l.vehicle_id
            WHERE l.customer_id = c.id AND (v.vrm LIKE ? OR v.make_model LIKE ? COLLATE NOCASE)
          )
          OR EXISTS (
            SELECT 1 FROM customer_notes n
            WHERE n.customer_id = c.id AND n.body LIKE ? COLLATE NOCASE
          )
          OR EXISTS (
            SELECT 1 FROM jobs j
            WHERE j.customer_id = c.id AND (j.description LIKE ? COLLATE NOCASE OR j.invoice_ref LIKE ? COLLATE NOCASE)
          )
       ORDER BY c.updated_at DESC
       LIMIT 75`
    : `SELECT c.*,
         (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status != 'blocked') AS visit_count,
         ${vrmsSelect} AS vrms
       FROM customers c
       ORDER BY c.updated_at DESC
       LIMIT 75`;

  const rows = (
    trimmed
      ? getDb().prepare(sql).all(like, like, like, like, compact, like, like, like, like)
      : getDb().prepare(sql).all()
  ) as Record<string, unknown>[];

  return rows.map((row) => ({
    ...mapCustomer(row),
    visit_count: Number(row.visit_count ?? 0),
    vrms: String(row.vrms ?? ''),
  })) satisfies CustomerListItem[];
}

export function createCustomer(input: { name: string; phone: string; email?: string; vrm?: string; profile_notes?: string }) {
  const now = new Date().toISOString();
  const existing = findCustomerByPhone(input.phone) || findCustomerByEmail(input.email ?? '') || findCustomerByVrm(input.vrm ?? '');
  if (existing) {
    if (input.vrm) upsertVehicleForCustomer(existing.id, input.vrm);
    if (input.profile_notes) {
      getDb()
        .prepare('UPDATE customers SET profile_notes = CASE WHEN length(profile_notes) = 0 THEN ? ELSE profile_notes END, updated_at = ? WHERE id = ?')
        .run(input.profile_notes, new Date().toISOString(), existing.id);
    }
    return getCustomer(existing.id)!;
  }
  const id = nextId('CUS');
  getDb()
    .prepare(
      `INSERT INTO customers (id, created_at, updated_at, name, phone, email, profile_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, now, now, input.name, input.phone, input.email ?? '', input.profile_notes ?? '');
  if (input.vrm) upsertVehicleForCustomer(id, input.vrm);
  return getCustomer(id)!;
}

export function updateCustomer(
  id: string,
  input: { name: string; phone: string; email: string; profile_notes: string },
) {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE customers SET name = ?, phone = ?, email = ?, profile_notes = ?, updated_at = ? WHERE id = ?`,
    )
    .run(input.name, input.phone, input.email, input.profile_notes, now, id);
  if (result.changes === 0) return null;
  return getCustomer(id);
}

export function addCustomerNote(customerId: string, body: string) {
  const text = body.trim();
  if (!text) return null;
  const id = nextId('NOTE');
  const now = new Date().toISOString();
  getDb().prepare('INSERT INTO customer_notes (id, customer_id, created_at, body) VALUES (?, ?, ?, ?)').run(id, customerId, now, text);
  getDb().prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, customerId);
  return listCustomerNotes(customerId)[0] ?? null;
}

export function addCustomerVehicle(customerId: string, vrm: string, makeModel = '') {
  const vehicle = upsertVehicleForCustomer(customerId, vrm, makeModel);
  getDb().prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), customerId);
  return vehicle;
}

export function formatNoteTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(iso));
}
