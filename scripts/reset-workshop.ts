import { randomBytes, scryptSync } from 'node:crypto';
import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const people = [
  { name: 'Stephen', username: 'stephen' },
  { name: 'Alison', username: 'alison' },
  { name: 'Colin', username: 'colin' },
  { name: 'Mack', username: 'mack' },
];

function password() {
  return randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, 'x').slice(0, 10);
}

function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`;
}

function nextId(prefix: string) {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

const sql = postgres(url, { max: 1, prepare: false, ssl: /localhost|127\.0\.0\.1/i.test(url) ? false : 'require' });

const tables = await sql<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
const names = new Set(tables.map((row) => row.tablename));
if (!names.has('staff') || !names.has('bookings')) {
  console.error('Supabase is missing the workshop tables. Open the site once with DATABASE_URL set, or paste schema.sql into the SQL editor, then rerun this script.');
  process.exit(1);
}

await sql.unsafe('DELETE FROM jobs');
await sql.unsafe('DELETE FROM customer_notes');
await sql.unsafe('DELETE FROM customer_vehicle_links');
await sql.unsafe('DELETE FROM bookings');
await sql.unsafe('DELETE FROM vehicles');
await sql.unsafe('DELETE FROM customers');
await sql.unsafe('DELETE FROM staff');

console.log('Workshop tables emptied.');
console.log('Logins (one-time — give these to the garage, do not commit):');

for (const person of people) {
  const generated = password();
  const now = new Date().toISOString();
  await sql.unsafe(
    `INSERT INTO staff (id, created_at, updated_at, name, username, password_hash, active)
     VALUES ($1, $2, $3, $4, $5, $6, 1)`,
    [nextId('STF'), now, now, person.name, person.username, hashPassword(generated)],
  );
  console.log(`${person.name}\t${person.username}\t${generated}`);
}

await sql.end();
