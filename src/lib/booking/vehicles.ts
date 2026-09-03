import { getDb } from './database';
import { nextId } from './ids';

export type Vehicle = {
  id: string;
  created_at: string;
  updated_at: string;
  vrm: string;
  make_model: string;
  engine: string;
  notes: string;
};

export type VehicleListItem = Vehicle & {
  owners: string;
  owner_count: number;
};

export type VehicleOwner = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    vrm: String(row.vrm),
    make_model: String(row.make_model ?? ''),
    engine: String(row.engine ?? ''),
    notes: String(row.notes ?? ''),
  };
}

function touchCustomer(customerId: string) {
  getDb().prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), customerId);
}

export function getVehicle(id: string) {
  const row = getDb().prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapVehicle(row) : null;
}

export function getVehicleByVrm(vrm: string) {
  if (!vrm || vrm === 'BLOCKED') return null;
  const row = getDb().prepare('SELECT * FROM vehicles WHERE vrm = ?').get(vrm) as Record<string, unknown> | undefined;
  return row ? mapVehicle(row) : null;
}

export function listCustomerVehicles(customerId: string) {
  const rows = getDb()
    .prepare(
      `SELECT v.* FROM vehicles v
       INNER JOIN customer_vehicle_links l ON l.vehicle_id = v.id
       WHERE l.customer_id = ?
       ORDER BY v.vrm ASC`,
    )
    .all(customerId) as Record<string, unknown>[];
  return rows.map(mapVehicle);
}

export function listVehicleOwners(vehicleId: string) {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.name, c.phone, c.email
       FROM customers c
       INNER JOIN customer_vehicle_links l ON l.customer_id = c.id
       WHERE l.vehicle_id = ?
       ORDER BY c.name COLLATE NOCASE ASC`,
    )
    .all(vehicleId) as Record<string, unknown>[];
  return rows.map(
    (row) =>
      ({
        id: String(row.id),
        name: String(row.name),
        phone: String(row.phone ?? ''),
        email: String(row.email ?? ''),
      }) satisfies VehicleOwner,
  );
}

export function listVehicleBookings(vehicleId: string) {
  const rows = getDb()
    .prepare(
      `SELECT b.* FROM bookings b
       WHERE b.vehicle_id = ? OR b.vrm = (SELECT vrm FROM vehicles WHERE id = ?)
       ORDER BY b.date DESC, b.time DESC`,
    )
    .all(vehicleId, vehicleId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    date: String(row.date),
    time: String(row.time),
    service: String(row.service),
    status: String(row.status),
    customer_name: String(row.customer_name ?? ''),
    customer_id: String(row.customer_id ?? ''),
    price: Number(row.price),
    notes: String(row.notes ?? ''),
  }));
}

export function linkCustomerToVehicle(customerId: string, vehicleId: string) {
  getDb()
    .prepare('INSERT OR IGNORE INTO customer_vehicle_links (customer_id, vehicle_id) VALUES (?, ?)')
    .run(customerId, vehicleId);
  touchCustomer(customerId);
}

export function unlinkCustomerFromVehicle(customerId: string, vehicleId: string) {
  getDb().prepare('DELETE FROM customer_vehicle_links WHERE customer_id = ? AND vehicle_id = ?').run(customerId, vehicleId);
  touchCustomer(customerId);
}

export function upsertVehicleForCustomer(
  customerId: string,
  vrm: string,
  makeModel = '',
  engine = '',
) {
  if (!vrm || vrm === 'BLOCKED') return null;
  const now = new Date().toISOString();
  const database = getDb();
  let vehicle = getVehicleByVrm(vrm);

  if (!vehicle) {
    const id = nextId('VEH');
    database
      .prepare(
        `INSERT INTO vehicles (id, created_at, updated_at, vrm, make_model, engine, notes)
         VALUES (?, ?, ?, ?, ?, ?, '')`,
      )
      .run(id, now, now, vrm, makeModel, engine);
    vehicle = getVehicle(id);
  } else if (makeModel || engine) {
    database
      .prepare(
        `UPDATE vehicles
         SET make_model = CASE WHEN length(?) > 0 THEN ? ELSE make_model END,
             engine = CASE WHEN length(?) > 0 THEN ? ELSE engine END,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(makeModel, makeModel, engine, engine, now, vehicle.id);
    vehicle = getVehicle(vehicle.id);
  }

  if (vehicle) linkCustomerToVehicle(customerId, vehicle.id);
  return vehicle;
}

export function createVehicle(input: { vrm: string; make_model?: string; engine?: string; notes?: string; customer_id?: string }) {
  const existing = getVehicleByVrm(input.vrm);
  if (existing) {
    if (input.customer_id) linkCustomerToVehicle(input.customer_id, existing.id);
    if (input.make_model || input.engine || input.notes) {
      updateVehicle(existing.id, {
        make_model: input.make_model ?? existing.make_model,
        engine: input.engine ?? existing.engine,
        notes: input.notes ?? existing.notes,
      });
    }
    return getVehicle(existing.id)!;
  }
  const now = new Date().toISOString();
  const id = nextId('VEH');
  getDb()
    .prepare(
      `INSERT INTO vehicles (id, created_at, updated_at, vrm, make_model, engine, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, now, now, input.vrm, input.make_model ?? '', input.engine ?? '', input.notes ?? '');
  if (input.customer_id) linkCustomerToVehicle(input.customer_id, id);
  return getVehicle(id)!;
}

export function updateVehicle(id: string, input: { make_model: string; engine: string; notes: string }) {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(`UPDATE vehicles SET make_model = ?, engine = ?, notes = ?, updated_at = ? WHERE id = ?`)
    .run(input.make_model, input.engine, input.notes, now, id);
  if (result.changes === 0) return null;
  return getVehicle(id);
}

export function searchVehicles(query: string) {
  const trimmed = query.trim();
  const like = `%${trimmed.replace(/\s+/g, '%')}%`;
  const compact = `%${trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '')}%`;

  const ownerSelect = `COALESCE((SELECT GROUP_CONCAT(c.name, ', ') FROM customer_vehicle_links l INNER JOIN customers c ON c.id = l.customer_id WHERE l.vehicle_id = v.id), '')`;
  const ownerCount = `(SELECT COUNT(*) FROM customer_vehicle_links l WHERE l.vehicle_id = v.id)`;

  const sql = trimmed
    ? `SELECT v.*, ${ownerSelect} AS owners, ${ownerCount} AS owner_count
       FROM vehicles v
       WHERE v.vrm LIKE ?
          OR v.make_model LIKE ? COLLATE NOCASE
          OR v.engine LIKE ? COLLATE NOCASE
          OR v.notes LIKE ? COLLATE NOCASE
          OR EXISTS (
            SELECT 1 FROM customer_vehicle_links l
            INNER JOIN customers c ON c.id = l.customer_id
            WHERE l.vehicle_id = v.id
              AND (c.name LIKE ? COLLATE NOCASE OR c.phone LIKE ? OR c.email LIKE ? COLLATE NOCASE)
          )
       ORDER BY v.updated_at DESC
       LIMIT 75`
    : `SELECT v.*, ${ownerSelect} AS owners, ${ownerCount} AS owner_count
       FROM vehicles v
       ORDER BY v.updated_at DESC
       LIMIT 75`;

  const rows = (
    trimmed ? getDb().prepare(sql).all(compact, like, like, like, like, like, like) : getDb().prepare(sql).all()
  ) as Record<string, unknown>[];

  return rows.map((row) => ({
    ...mapVehicle(row),
    owners: String(row.owners ?? ''),
    owner_count: Number(row.owner_count ?? 0),
  })) satisfies VehicleListItem[];
}
