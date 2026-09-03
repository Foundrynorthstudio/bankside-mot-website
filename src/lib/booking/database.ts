import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { nextId } from './ids';

const onNetlify = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbPath = onNetlify ? '/tmp/bankside-bookings.db' : resolve(process.cwd(), 'data/bookings.db');

let db: DatabaseSync | undefined;

function columnNames(database: DatabaseSync, table: string) {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((row) => row.name);
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      service TEXT NOT NULL,
      price INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      diary TEXT NOT NULL DEFAULT 'mot',
      resource TEXT NOT NULL DEFAULT 'bay',
      vrm TEXT NOT NULL,
      vehicle_make_model TEXT NOT NULL DEFAULT '',
      vehicle_engine TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'Pay at Garage',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      profile_notes TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

    CREATE TABLE IF NOT EXISTS customer_vehicles (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      vrm TEXT NOT NULL,
      make_model TEXT NOT NULL DEFAULT '',
      engine TEXT NOT NULL DEFAULT '',
      UNIQUE(customer_id, vrm)
    );
    CREATE INDEX IF NOT EXISTS idx_vehicles_vrm ON customer_vehicles(vrm);
    CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON customer_vehicles(customer_id);

    CREATE TABLE IF NOT EXISTS customer_notes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      body TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notes_customer ON customer_notes(customer_id, created_at);

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      vrm TEXT NOT NULL UNIQUE,
      make_model TEXT NOT NULL DEFAULT '',
      engine TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_vehicles_record_vrm ON vehicles(vrm);

    CREATE TABLE IF NOT EXISTS customer_vehicle_links (
      customer_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      PRIMARY KEY (customer_id, vehicle_id)
    );
    CREATE INDEX IF NOT EXISTS idx_links_vehicle ON customer_vehicle_links(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_links_customer ON customer_vehicle_links(customer_id);

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL DEFAULT '',
      booking_id TEXT NOT NULL DEFAULT '',
      job_date TEXT NOT NULL,
      description TEXT NOT NULL,
      invoice_ref TEXT NOT NULL DEFAULT '',
      amount_pence INTEGER NOT NULL DEFAULT 0,
      paid_pence INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id, job_date);
    CREATE INDEX IF NOT EXISTS idx_jobs_vehicle ON jobs(vehicle_id);
  `);

  if (!columnNames(database, 'bookings').includes('customer_id')) {
    database.exec(`ALTER TABLE bookings ADD COLUMN customer_id TEXT NOT NULL DEFAULT ''`);
  }
  if (!columnNames(database, 'bookings').includes('vehicle_id')) {
    database.exec(`ALTER TABLE bookings ADD COLUMN vehicle_id TEXT NOT NULL DEFAULT ''`);
  }
  const addedDiary = !columnNames(database, 'bookings').includes('diary');
  if (addedDiary) {
    database.exec(`ALTER TABLE bookings ADD COLUMN diary TEXT NOT NULL DEFAULT 'mot'`);
  }
  if (!columnNames(database, 'bookings').includes('resource')) {
    database.exec(`ALTER TABLE bookings ADD COLUMN resource TEXT NOT NULL DEFAULT 'bay'`);
  }
  if (addedDiary) {
    database.exec(`
      UPDATE bookings
      SET diary = 'service', resource = 'mech-1'
      WHERE vrm != 'BLOCKED'
        AND service NOT IN ('Class 4 MOT', 'Class 7 MOT', 'Unavailable')
    `);
  }
  database.exec(`DROP INDEX IF EXISTS idx_active_slot`);
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_bay
      ON bookings(diary, resource, date, time)
      WHERE status IN ('confirmed', 'blocked', 'completed')
  `);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings(vehicle_id)`);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_diary ON bookings(diary, date)`);

  migrateLegacyVehicles(database);
  database.exec(`
    UPDATE bookings
    SET vehicle_id = COALESCE((SELECT id FROM vehicles WHERE vehicles.vrm = bookings.vrm), '')
    WHERE length(vehicle_id) = 0 AND vrm != 'BLOCKED' AND length(vrm) > 0
  `);
}

function migrateLegacyVehicles(database: DatabaseSync) {
  const legacy = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'customer_vehicles'`).get() as
    | { name: string }
    | undefined;
  if (!legacy) return;

  const rows = database.prepare('SELECT * FROM customer_vehicles').all() as Record<string, unknown>[];
  for (const row of rows) {
    const vrm = String(row.vrm ?? '');
    if (!vrm || vrm === 'BLOCKED') continue;
    const makeModel = String(row.make_model ?? '');
    const engine = String(row.engine ?? '');
    const customerId = String(row.customer_id ?? '');
    if (!customerId) continue;

    let vehicle = database.prepare('SELECT id, make_model, engine FROM vehicles WHERE vrm = ?').get(vrm) as
      | { id: string; make_model: string; engine: string }
      | undefined;
    if (!vehicle) {
      const id = nextId('VEH');
      const now = new Date().toISOString();
      database
        .prepare(
          `INSERT INTO vehicles (id, created_at, updated_at, vrm, make_model, engine, notes)
           VALUES (?, ?, ?, ?, ?, ?, '')`,
        )
        .run(id, now, now, vrm, makeModel, engine);
      vehicle = { id, make_model: makeModel, engine };
    } else if ((makeModel && !vehicle.make_model) || (engine && !vehicle.engine)) {
      database
        .prepare(
          `UPDATE vehicles
           SET make_model = CASE WHEN length(?) > 0 AND length(make_model) = 0 THEN ? ELSE make_model END,
               engine = CASE WHEN length(?) > 0 AND length(engine) = 0 THEN ? ELSE engine END
           WHERE id = ?`,
        )
        .run(makeModel, makeModel, engine, engine, vehicle.id);
    }
    database
      .prepare('INSERT OR IGNORE INTO customer_vehicle_links (customer_id, vehicle_id) VALUES (?, ?)')
      .run(customerId, vehicle.id);
  }
}

export function getDb() {
  if (!db) {
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    migrate(db);
  }
  return db;
}
