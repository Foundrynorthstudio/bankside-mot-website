import { ciEq, ciLike, isPostgres, sqlAll, sqlGet, sqlRun, stringAgg } from './database';
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

export async function getCustomer(id: string) {
  const row = await sqlGet('SELECT * FROM customers WHERE id = $1', [id]);
  return row ? mapCustomer(row) : null;
}

export async function listCustomerNotes(customerId: string) {
  const rows = await sqlAll('SELECT * FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC', [
    customerId,
  ]);
  return rows.map((row) => ({
    id: String(row.id),
    customer_id: String(row.customer_id),
    created_at: String(row.created_at),
    body: String(row.body),
  })) satisfies CustomerNote[];
}

export async function listCustomerBookings(customerId: string) {
  const rows = await sqlAll(
    `SELECT * FROM bookings
     WHERE customer_id = $1
     ORDER BY date DESC, time DESC`,
    [customerId],
  );
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

function phoneLookupKeys(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return [];
  const digits = trimmed.replace(/\D/g, '');
  const keys = new Set<string>([trimmed]);
  if (digits) keys.add(digits);
  if (digits.startsWith('44') && digits.length >= 12) {
    keys.add(`0${digits.slice(2)}`);
    keys.add(`+${digits}`);
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    keys.add(`44${digits.slice(1)}`);
    keys.add(`+44${digits.slice(1)}`);
  }
  return [...keys];
}

export async function findCustomerByPhone(phone: string) {
  if (!phone) return null;
  for (const key of phoneLookupKeys(phone)) {
    const row = await sqlGet('SELECT * FROM customers WHERE phone = $1 LIMIT 1', [key]);
    if (row) return mapCustomer(row);
  }
  const digits = phone.replace(/\D/g, '');
  const tail = digits.slice(-10);
  if (tail.length < 10) return null;
  const row = isPostgres()
    ? await sqlGet(
        `SELECT * FROM customers
         WHERE length(phone) > 0
           AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1
         LIMIT 1`,
        [tail],
      )
    : await sqlGet(
        `SELECT * FROM customers
         WHERE length(phone) > 0
           AND substr(replace(replace(replace(replace(replace(phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), -10) = $1
         LIMIT 1`,
        [tail],
      );
  return row ? mapCustomer(row) : null;
}

export async function findCustomerByEmail(email: string) {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;
  const row = await sqlGet(`SELECT * FROM customers WHERE ${ciEq('email', '$1')} LIMIT 1`, [normalised]);
  return row ? mapCustomer(row) : null;
}

export async function findCustomerByUniqueName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 3 || !/\s/.test(trimmed)) return null;
  const rows = await sqlAll(`SELECT * FROM customers WHERE ${ciEq('name', '$1')}`, [trimmed]);
  if (rows.length !== 1) return null;
  return mapCustomer(rows[0]);
}

export async function findExistingCustomer(input: { id?: string; phone?: string; email?: string; name?: string }) {
  if (input.id) {
    const byId = await getCustomer(input.id);
    if (byId) return byId;
  }
  return (
    (await findCustomerByPhone(input.phone ?? '')) ||
    (await findCustomerByEmail(input.email ?? '')) ||
    (await findCustomerByUniqueName(input.name ?? ''))
  );
}

export async function upsertCustomerFromBooking(input: {
  name: string;
  phone: string;
  email?: string;
  vrm: string;
  vehicle_make_model?: string;
  vehicle_engine?: string;
}) {
  if (!input.vrm || input.vrm === 'BLOCKED') return { customer: null, vehicle: null };

  const existing = await findExistingCustomer({ phone: input.phone, email: input.email, name: input.name });
  const now = new Date().toISOString();

  if (existing) {
    await sqlRun(
      `UPDATE customers
       SET name = $1, phone = CASE WHEN length($2) > 0 THEN $2 ELSE phone END,
           email = CASE WHEN length($3) > 0 THEN $3 ELSE email END,
           updated_at = $4
       WHERE id = $5`,
      [input.name, input.phone, input.email ?? '', now, existing.id],
    );
    const vehicle = await upsertVehicleForCustomer(existing.id, input.vrm, input.vehicle_make_model, input.vehicle_engine);
    return { customer: await getCustomer(existing.id), vehicle };
  }

  const id = nextId('CUS');
  await sqlRun(
    `INSERT INTO customers (id, created_at, updated_at, name, phone, email, profile_notes)
     VALUES ($1, $2, $3, $4, $5, $6, '')`,
    [id, now, now, input.name, input.phone, input.email ?? ''],
  );
  const vehicle = await upsertVehicleForCustomer(id, input.vrm, input.vehicle_make_model, input.vehicle_engine);
  return { customer: await getCustomer(id), vehicle };
}

export async function backfillCustomersFromBookings() {
  const rows = await sqlAll(
    `SELECT * FROM bookings
     WHERE status != 'blocked'
       AND vrm != 'BLOCKED'
       AND (customer_id IS NULL OR length(customer_id) = 0)
     ORDER BY created_at ASC`,
  );

  for (const row of rows) {
    const { customer, vehicle } = await upsertCustomerFromBooking({
      name: String(row.customer_name),
      phone: String(row.customer_phone),
      email: String(row.customer_email ?? ''),
      vrm: String(row.vrm),
      vehicle_make_model: String(row.vehicle_make_model ?? ''),
      vehicle_engine: String(row.vehicle_engine ?? ''),
    });
    if (customer) {
      await sqlRun('UPDATE bookings SET customer_id = $1, vehicle_id = $2 WHERE id = $3', [
        customer.id,
        vehicle?.id ?? '',
        String(row.id),
      ]);
    }
  }
}

export async function searchCustomers(query: string) {
  await backfillCustomersFromBookings();
  const trimmed = query.trim();
  const like = `%${trimmed.replace(/\s+/g, '%')}%`;
  const compact = `%${trimmed.toUpperCase().replace(/[^A-Z0-9+]/g, '')}%`;
  const vrmsSelect = `COALESCE((SELECT ${stringAgg('v.vrm')} FROM customer_vehicle_links l INNER JOIN vehicles v ON v.id = l.vehicle_id WHERE l.customer_id = c.id), '')`;

  const sql = trimmed
    ? `SELECT c.*,
         (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status != 'blocked') AS visit_count,
         ${vrmsSelect} AS vrms
       FROM customers c
       WHERE ${ciLike('c.name', '$1')}
          OR c.phone LIKE $2
          OR ${ciLike('c.email', '$3')}
          OR ${ciLike('c.profile_notes', '$4')}
          OR EXISTS (
            SELECT 1 FROM customer_vehicle_links l
            INNER JOIN vehicles v ON v.id = l.vehicle_id
            WHERE l.customer_id = c.id AND (v.vrm LIKE $5 OR ${ciLike('v.make_model', '$6')})
          )
          OR EXISTS (
            SELECT 1 FROM customer_notes n
            WHERE n.customer_id = c.id AND ${ciLike('n.body', '$7')}
          )
          OR EXISTS (
            SELECT 1 FROM jobs j
            WHERE j.customer_id = c.id AND (${ciLike('j.description', '$8')} OR ${ciLike('j.invoice_ref', '$9')})
          )
       ORDER BY c.updated_at DESC
       LIMIT 75`
    : `SELECT c.*,
         (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status != 'blocked') AS visit_count,
         ${vrmsSelect} AS vrms
       FROM customers c
       ORDER BY c.updated_at DESC
       LIMIT 75`;

  const rows = trimmed ? await sqlAll(sql, [like, like, like, like, compact, like, like, like, like]) : await sqlAll(sql);

  return rows.map((row) => ({
    ...mapCustomer(row),
    visit_count: Number(row.visit_count ?? 0),
    vrms: String(row.vrms ?? ''),
  })) satisfies CustomerListItem[];
}

export async function createCustomer(input: {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  vrm?: string;
  make_model?: string;
  engine?: string;
  profile_notes?: string;
}) {
  const now = new Date().toISOString();
  const existing = await findExistingCustomer({
    id: input.id,
    phone: input.phone,
    email: input.email,
    name: input.name,
  });
  if (existing) {
    await sqlRun(
      `UPDATE customers
       SET phone = CASE WHEN length($1) > 0 THEN $1 ELSE phone END,
           email = CASE WHEN length($2) > 0 THEN $2 ELSE email END,
           profile_notes = CASE WHEN length(profile_notes) = 0 AND length($3) > 0 THEN $3 ELSE profile_notes END,
           updated_at = $4
       WHERE id = $5`,
      [input.phone, input.email ?? '', input.profile_notes ?? '', now, existing.id],
    );
    if (input.vrm) await upsertVehicleForCustomer(existing.id, input.vrm, input.make_model, input.engine);
    return (await getCustomer(existing.id))!;
  }
  const id = nextId('CUS');
  await sqlRun(
    `INSERT INTO customers (id, created_at, updated_at, name, phone, email, profile_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, now, now, input.name, input.phone, input.email ?? '', input.profile_notes ?? ''],
  );
  if (input.vrm) await upsertVehicleForCustomer(id, input.vrm, input.make_model, input.engine);
  return (await getCustomer(id))!;
}

export async function updateCustomer(
  id: string,
  input: { name: string; phone: string; email: string; profile_notes: string },
) {
  const now = new Date().toISOString();
  const result = await sqlRun(
    `UPDATE customers SET name = $1, phone = $2, email = $3, profile_notes = $4, updated_at = $5 WHERE id = $6`,
    [input.name, input.phone, input.email, input.profile_notes, now, id],
  );
  if (result.changes === 0) return null;
  return getCustomer(id);
}

export async function addCustomerNote(customerId: string, body: string) {
  const text = body.trim();
  if (!text) return null;
  const id = nextId('NOTE');
  const now = new Date().toISOString();
  await sqlRun('INSERT INTO customer_notes (id, customer_id, created_at, body) VALUES ($1, $2, $3, $4)', [
    id,
    customerId,
    now,
    text,
  ]);
  await sqlRun('UPDATE customers SET updated_at = $1 WHERE id = $2', [now, customerId]);
  return (await listCustomerNotes(customerId))[0] ?? null;
}

export async function addCustomerVehicle(customerId: string, vrm: string, makeModel = '', engine = '') {
  const vehicle = await upsertVehicleForCustomer(customerId, vrm, makeModel, engine);
  await sqlRun('UPDATE customers SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), customerId]);
  return vehicle;
}

export function formatNoteTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(iso));
}
