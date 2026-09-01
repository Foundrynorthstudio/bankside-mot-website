import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve(process.cwd(), 'data/bookings.db');

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
      vrm TEXT NOT NULL,
      vehicle_make_model TEXT NOT NULL DEFAULT '',
      vehicle_engine TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'Pay at Garage',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_slot
      ON bookings(date, time)
      WHERE status IN ('confirmed', 'blocked', 'completed');
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
  `);

  if (!columnNames(database, 'bookings').includes('customer_id')) {
    database.exec(`ALTER TABLE bookings ADD COLUMN customer_id TEXT NOT NULL DEFAULT ''`);
  }
  database.exec(`CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id)`);
}

export function getDb() {
  if (!db) {
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    migrate(db);
  }
  return db;
}
