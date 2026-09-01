import { randomInt } from 'node:crypto';
import { upsertCustomerFromBooking } from './customers';
import { getDb } from './database';
import type { Booking, BookingInput, BookingStatus } from './types';

function nextRef(): string {
  return `BMK-${randomInt(100000, 1000000)}`;
}

export class SlotTakenError extends Error {
  constructor() {
    super('That time slot is no longer available.');
    this.name = 'SlotTakenError';
  }
}

function mapRow(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    status: row.status as Booking['status'],
    source: row.source as Booking['source'],
    service: String(row.service),
    price: Number(row.price),
    date: String(row.date),
    time: String(row.time),
    vrm: String(row.vrm),
    vehicle_make_model: String(row.vehicle_make_model ?? ''),
    vehicle_engine: String(row.vehicle_engine ?? ''),
    customer_name: String(row.customer_name),
    customer_phone: String(row.customer_phone),
    customer_email: String(row.customer_email ?? ''),
    payment_method: String(row.payment_method ?? 'Pay at Garage'),
    notes: String(row.notes ?? ''),
    customer_id: String(row.customer_id ?? ''),
  };
}

export function listBookingsBetween(startDate: string, endDate: string) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM bookings
       WHERE date >= ? AND date <= ?
       AND status IN ('confirmed', 'blocked', 'completed')
       ORDER BY date ASC, time ASC`,
    )
    .all(startDate, endDate) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export function listBookingsOnDate(date: string) {
  return listBookingsBetween(date, date);
}

export function getBooking(id: string) {
  const row = getDb().prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function createBooking(input: BookingInput): Booking {
  const now = new Date().toISOString();
  const isBlocked = (input.status ?? 'confirmed') === 'blocked' || input.vrm === 'BLOCKED';
  const customer = isBlocked
    ? null
    : upsertCustomerFromBooking({
        name: input.customer_name,
        phone: input.customer_phone,
        email: input.customer_email,
        vrm: input.vrm,
        vehicle_make_model: input.vehicle_make_model,
        vehicle_engine: input.vehicle_engine,
      });
  const database = getDb();
  const insert = database.prepare(`
    INSERT INTO bookings (
      id, created_at, updated_at, status, source, service, price, date, time,
      vrm, vehicle_make_model, vehicle_engine, customer_name, customer_phone,
      customer_email, payment_method, notes, customer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = nextRef();
    try {
      insert.run(
        id,
        now,
        now,
        input.status ?? 'confirmed',
        input.source ?? 'online',
        input.service,
        input.price,
        input.date,
        input.time,
        input.vrm,
        input.vehicle_make_model ?? '',
        input.vehicle_engine ?? '',
        input.customer_name,
        input.customer_phone,
        input.customer_email ?? '',
        input.payment_method ?? 'Pay at Garage',
        input.notes ?? '',
        customer?.id ?? '',
      );
      return getBooking(id)!;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE') || message.includes('unique')) {
        throw new SlotTakenError();
      }
      if (message.includes('PRIMARY') || message.includes('UNIQUE constraint failed: bookings.id')) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Could not allocate a booking reference.');
}

export function updateBookingStatus(id: string, status: BookingStatus) {
  const now = new Date().toISOString();
  const result = getDb().prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  if (result.changes === 0) return null;
  return getBooking(id);
}
