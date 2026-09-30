import { randomInt } from 'node:crypto';
import { diaryById, diaryForService, parseDiaryId } from './config';
import { upsertCustomerFromBooking } from './customers';
import { sqlAll, sqlGet, sqlRun, UniqueViolationError } from './database';
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

export async function listBookingsBetween(startDate: string, endDate: string, diary?: string) {
  const rows = diary
    ? await sqlAll(
        `SELECT * FROM bookings
         WHERE date >= $1 AND date <= $2
           AND diary = $3
           AND status IN ('confirmed', 'blocked', 'completed')
         ORDER BY date ASC, time ASC`,
        [startDate, endDate, diary],
      )
    : await sqlAll(
        `SELECT * FROM bookings
         WHERE date >= $1 AND date <= $2
           AND status IN ('confirmed', 'blocked', 'completed')
         ORDER BY date ASC, time ASC`,
        [startDate, endDate],
      );
  return rows.map(mapRow);
}

export async function listBookingsOnDate(date: string, diary?: string) {
  return listBookingsBetween(date, date, diary);
}

export async function getBooking(id: string) {
  const row = await sqlGet('SELECT * FROM bookings WHERE id = $1', [id]);
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

function isIdClash(error: UniqueViolationError) {
  return /pkey|_pkey|bookings\.id/i.test(error.constraint) || /bookings\.id/i.test(error.message);
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  const now = new Date().toISOString();
  const isBlocked = (input.status ?? 'confirmed') === 'blocked' || input.vrm === 'BLOCKED';
  const linked = isBlocked
    ? { customer: null, vehicle: null }
    : await upsertCustomerFromBooking({
        name: input.customer_name,
        phone: input.customer_phone,
        email: input.customer_email,
        vrm: input.vrm,
        vehicle_make_model: input.vehicle_make_model,
        vehicle_engine: input.vehicle_engine,
      });
  const { diaryId, resources } = resourceCandidates(input);

  for (const resource of resources) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = nextRef();
      try {
        await sqlRun(
          `INSERT INTO bookings (
            id, created_at, updated_at, status, source, service, price, date, time,
            diary, resource, vrm, vehicle_make_model, vehicle_engine, customer_name, customer_phone,
            customer_email, payment_method, notes, customer_id, vehicle_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [
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
          ],
        );
        return (await getBooking(id))!;
      } catch (error) {
        if (error instanceof UniqueViolationError && isIdClash(error)) continue;
        if (error instanceof UniqueViolationError) break;
        throw error;
      }
    }
  }

  throw new SlotTakenError();
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const now = new Date().toISOString();
  const result = await sqlRun('UPDATE bookings SET status = $1, updated_at = $2 WHERE id = $3', [status, now, id]);
  if (result.changes === 0) return null;
  return getBooking(id);
}
