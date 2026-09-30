import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import postgres from 'postgres';
import { env } from './config';
import { nextId } from './ids';
import schemaSql from './schema.sql?raw';

type Row = Record<string, unknown>;

const onNetlify = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const sqlitePath = onNetlify ? '/tmp/bankside-bookings.db' : resolve(process.cwd(), 'data/bookings.db');

let sqlite: DatabaseSync | undefined;
let pg: postgres.Sql | undefined;
let migrated = false;

export class UniqueViolationError extends Error {
  constructor(
    readonly constraint = '',
    message = 'unique_violation',
  ) {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

export function databaseUrl() {
  return env('DATABASE_URL', env('SUPABASE_DB_URL'));
}

export function isPostgres() {
  return databaseUrl().length > 0;
}

export function ciEq(column: string, placeholder: string) {
  return isPostgres() ? `lower(${column}) = lower(${placeholder})` : `${column} = ${placeholder} COLLATE NOCASE`;
}

export function ciLike(column: string, placeholder: string) {
  return isPostgres() ? `${column} ILIKE ${placeholder}` : `${column} LIKE ${placeholder} COLLATE NOCASE`;
}

export function stringAgg(expr: string) {
  return isPostgres() ? `string_agg(${expr}, ', ')` : `group_concat(${expr}, ', ')`;
}

function sqliteQuery(text: string, params: unknown[]) {
  const values: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_match, n: string) => {
    values.push(params[Number(n) - 1]);
    return '?';
  });
  return { sql, values };
}

function isUniqueError(error: unknown) {
  if (error instanceof UniqueViolationError) return true;
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /unique/i.test(message);
}

function uniqueConstraint(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as { constraint_name?: string; constraint?: string };
    return record.constraint_name || record.constraint || '';
  }
  return '';
}

function toUniqueError(error: unknown) {
  if (error instanceof UniqueViolationError) return error;
  if (isUniqueError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return new UniqueViolationError(uniqueConstraint(error), message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function getSqlite() {
  if (!sqlite) {
    mkdirSync(dirname(sqlitePath), { recursive: true });
    sqlite = new DatabaseSync(sqlitePath);
    migrateSqlite(sqlite);
  }
  return sqlite;
}

function getPg() {
  if (!pg) {
    const url = databaseUrl();
    const local = /localhost|127\.0\.0\.1/i.test(url);
    pg = postgres(url, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: local ? false : 'require',
      connection: {
        statement_timeout: 8000,
      },
    });
  }
  return pg;
}

function schemaStatements(sql: string) {
  return sql
    .split(';')
    .map((part) =>
      part
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
}

async function migratePostgres() {
  if (migrated) return;
  const client = getPg();
  const existing = (await client.unsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )) as { tablename: string }[];
  const tables = new Set(existing.map((row) => row.tablename));
  const ready = ['bookings', 'customers', 'vehicles', 'jobs', 'staff'].every((name) => tables.has(name));
  if (ready) {
    migrated = true;
    return;
  }

  const skipRls = tables.has('bookings');
  for (const statement of schemaStatements(schemaSql)) {
    if (skipRls && /ENABLE ROW LEVEL SECURITY/i.test(statement)) continue;
    await client.unsafe(statement);
  }
  migrated = true;
}

export async function sqlAll<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (isPostgres()) {
    await migratePostgres();
    try {
      const rows = await getPg().unsafe(text, params as never[]);
      return rows as unknown as T[];
    } catch (error) {
      throw toUniqueError(error);
    }
  }
  try {
    const query = sqliteQuery(text, params);
    return getSqlite().prepare(query.sql).all(...query.values) as T[];
  } catch (error) {
    throw toUniqueError(error);
  }
}

export async function sqlGet<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await sqlAll<T>(text, params);
  return rows[0];
}

export async function sqlRun(text: string, params: unknown[] = []): Promise<{ changes: number }> {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && !isPostgres()) {
    throw new Error('DATABASE_URL is not set. Live bookings need the Supabase connection string.');
  }
  if (isPostgres()) {
    await migratePostgres();
    try {
      const result = await getPg().unsafe(text, params as never[]);
      return { changes: result.count ?? 0 };
    } catch (error) {
      throw toUniqueError(error);
    }
  }
  try {
    const query = sqliteQuery(text, params);
    const result = getSqlite().prepare(query.sql).run(...query.values);
    return { changes: Number(result.changes ?? 0) };
  } catch (error) {
    throw toUniqueError(error);
  }
}

function columnNames(database: DatabaseSync, table: string) {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((row) => row.name);
}

function migrateSqlite(database: DatabaseSync) {
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

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
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
