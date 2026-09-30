import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sqlAll, sqlGet, sqlRun, UniqueViolationError } from './database';
import { nextId } from './ids';

export type Staff = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  username: string;
  active: boolean;
};

function mapStaff(row: Record<string, unknown>): Staff {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    name: String(row.name),
    username: String(row.username),
    active: Number(row.active) === 1,
  };
}

export function normaliseUsername(value: string) {
  return value.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, 'hex');
  return next.length === prev.length && timingSafeEqual(next, prev);
}

export function validateStaffFields(input: { name: string; username: string; password?: string; requirePassword?: boolean }) {
  const name = input.name.trim();
  const username = normaliseUsername(input.username);
  if (name.length < 2) return 'Enter the person’s name.';
  if (!/^[a-z][a-z0-9]{1,31}$/.test(username)) return 'Username must be letters and numbers, starting with a letter.';
  if (input.requirePassword !== false) {
    const password = input.password ?? '';
    if (password.length < 8) return 'Password must be at least 8 characters.';
  }
  return '';
}

export async function listStaff() {
  const rows = await sqlAll('SELECT * FROM staff ORDER BY name ASC');
  return rows.map(mapStaff);
}

export async function getStaff(id: string) {
  const row = await sqlGet('SELECT * FROM staff WHERE id = $1', [id]);
  return row ? mapStaff(row) : null;
}

export async function getStaffByUsername(username: string) {
  const row = await sqlGet('SELECT * FROM staff WHERE username = $1', [normaliseUsername(username)]);
  return row ? mapStaff(row) : null;
}

export async function getStaffAuth(username: string) {
  const row = await sqlGet('SELECT * FROM staff WHERE username = $1', [normaliseUsername(username)]);
  return row ? { ...mapStaff(row), password_hash: String(row.password_hash) } : null;
}

export async function createStaff(input: { name: string; username: string; password: string }) {
  const invalid = validateStaffFields({ ...input, requirePassword: true });
  if (invalid) return { error: invalid, staff: null };
  const username = normaliseUsername(input.username);
  const existing = await getStaffByUsername(username);
  if (existing) return { error: 'That username is already in use.', staff: null };
  const now = new Date().toISOString();
  const id = nextId('STF');
  try {
    await sqlRun(
      `INSERT INTO staff (id, created_at, updated_at, name, username, password_hash, active)
       VALUES ($1, $2, $3, $4, $5, $6, 1)`,
      [id, now, now, input.name.trim(), username, hashPassword(input.password)],
    );
  } catch (error) {
    if (error instanceof UniqueViolationError) return { error: 'That username is already in use.', staff: null };
    throw error;
  }
  return { error: '', staff: await getStaff(id) };
}

export async function setStaffActive(id: string, active: boolean) {
  const now = new Date().toISOString();
  await sqlRun('UPDATE staff SET active = $1, updated_at = $2 WHERE id = $3', [active ? 1 : 0, now, id]);
  return getStaff(id);
}

export async function resetStaffPassword(id: string, password: string) {
  if (password.length < 8) return { error: 'Password must be at least 8 characters.', staff: null };
  const now = new Date().toISOString();
  const result = await sqlRun('UPDATE staff SET password_hash = $1, updated_at = $2 WHERE id = $3', [
    hashPassword(password),
    now,
    id,
  ]);
  if (result.changes === 0) return { error: 'Staff account not found.', staff: null };
  return { error: '', staff: await getStaff(id) };
}
