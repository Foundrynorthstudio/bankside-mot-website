import { randomInt } from 'node:crypto';
import { diaryById, diaryForService, parseDiaryId } from './config';
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
    vehicle_id: String(row.vehicle_id ?? ''),
    diary: String(row.diary ?? 'mot'),
    resource: String(row.resource ?? 'bay'),
  };
}

export function listBookingsBetween(startDate: string, endDate: string, diary?: string) {
  const database = getDb();
  const rows = (
    diary
      ? database
          .prepare(
            `SELECT * FROM bookings
             WHERE date >= ? AND date <= ?
               AND diary = ?
               AND status IN ('confirmed', 'blocked', 'completed')
             ORDER BY date ASC, time ASC`,
          )
          .all(startDate, endDate, diary)
      : database
          .prepare(
            `SELECT * FROM bookings
             WHERE date >= ? AND date <= ?
               AND status IN ('confirmed', 'blocked', 'completed')
             ORDER BY date ASC, time ASC`,
          )
          .all(startDate, endDate)
  ) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export function listBookingsOnDate(date: string, diary?: string) {
  return listBookingsBetween(date, date, diary);
}

export function getBooking(id: string) {
  const row = getDb().prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

function resourceCandidates(input: BookingInput) {
  const diaryId = parseDiaryId(input.diary || diaryForService(input.service));
  const diary = diaryById(diaryId);
  if (input.resource && diary.resources.some((resource) => resource.id === input.resource)) {
    return { diaryId, resources: [input.resource] };
  }
  return { diaryId, resources: diary.resources.map((resource) => resource.id) };
}

export function createBooking(input: BookingInput): Booking {
  const now = new Date().toISOString();
  const isBlocked = (input.status ?? 'confirmed') === 'blocked' || input.vrm === 'BLOCKED';
  const linked = isBlocked
    ? { customer: null, vehicle: null }
    : upsertCustomerFromBooking({
        name: input.customer_name,
        phone: input.customer_phone,
        email: input.customer_email,
        vrm: input.vrm,
        vehicle_make_model: input.vehicle_make_model,
        vehicle_engine: input.vehicle_engine,
      });
  const { diaryId, resources } = resourceCandidates(input);
  const database = getDb();
  const insert = database.prepare(`
    INSERT INTO bookings (
      id, created_at, updated_at, status, source, service, price, date, time,
      diary, resource, vrm, vehicle_make_model, vehicle_engine, customer_name, customer_phone,
      customer_email, payment_method, notes, customer_id, vehicle_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const resource of resources) {
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
          diaryId,
          resource,
          input.vrm,
          input.vehicle_make_model ?? '',
          input.vehicle_engine ?? '',
          input.customer_name,
          input.customer_phone,
          input.customer_email ?? '',
          input.payment_method ?? 'Pay at Garage',
          input.notes ?? '',
          linked.customer?.id ?? '',
          linked.vehicle?.id ?? '',
        );
        return getBooking(id)!;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('UNIQUE constraint failed: bookings.id') || message.includes('PRIMARY')) {
          continue;
        }
        if (message.includes('UNIQUE') || message.includes('unique')) {
          break;
        }
        throw error;
      }
    }
  }

  throw new SlotTakenError();
}

export function updateBookingStatus(id: string, status: BookingStatus) {
  const now = new Date().toISOString();
  const result = getDb().prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  if (result.changes === 0) return null;
  return getBooking(id);
}
