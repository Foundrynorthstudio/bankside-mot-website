import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { env } from './config';
import { getStaffAuth, verifyPassword } from './staff';

const COOKIE = 'bankside_admin';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  return env('SESSION_SECRET', env('ADMIN_PASSWORD', 'dev-session-secret-change-me'));
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('hex');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function adminCredentials() {
  return {
    username: env('ADMIN_USERNAME', 'manager'),
    password: env('ADMIN_PASSWORD', 'bankside-local'),
  };
}

export async function verifyAdminLogin(username: string, password: string) {
  const normalised = username.trim().toLowerCase();
  if (!normalised || !password) return null;

  const staff = await getStaffAuth(normalised);
  if (staff) {
    if (!staff.active) return null;
    if (!verifyPassword(password, staff.password_hash)) return null;
    return { username: staff.username, name: staff.name };
  }

  const expected = adminCredentials();
  if (safeEqual(normalised, expected.username.toLowerCase()) && safeEqual(password, expected.password)) {
    return { username: expected.username.toLowerCase(), name: 'Manager' };
  }
  return null;
}

export function createAdminSession(cookies: AstroCookies, username: string) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${username.toLowerCase()}.${expires}`;
  cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearAdminSession(cookies: AstroCookies) {
  cookies.delete(COOKIE, { path: '/' });
}

export function readAdminSession(cookies: AstroCookies) {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw) return '';
  const lastDot = raw.lastIndexOf('.');
  if (lastDot <= 0) return '';
  const payload = raw.slice(0, lastDot);
  const signature = raw.slice(lastDot + 1);
  if (!safeEqual(sign(payload), signature)) return '';
  const expiresDot = payload.lastIndexOf('.');
  if (expiresDot <= 0) return '';
  const username = payload.slice(0, expiresDot);
  const expires = Number(payload.slice(expiresDot + 1));
  if (!Number.isFinite(expires) || expires <= Date.now() || !username) return '';
  return username;
}

export function isEmailConfigured() {
  return Boolean(env('SMTP_HOST'));
}
