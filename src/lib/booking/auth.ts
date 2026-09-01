import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { env } from './config';

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

export function verifyAdminCredentials(username: string, password: string) {
  const expected = adminCredentials();
  return safeEqual(username.trim().toLowerCase(), expected.username.toLowerCase()) && safeEqual(password, expected.password);
}

export function createAdminSession(cookies: AstroCookies) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `manager.${expires}`;
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
  if (!raw) return false;
  const lastDot = raw.lastIndexOf('.');
  if (lastDot <= 0) return false;
  const payload = raw.slice(0, lastDot);
  const signature = raw.slice(lastDot + 1);
  if (!safeEqual(sign(payload), signature)) return false;
  const expires = Number(payload.split('.')[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

export function isEmailConfigured() {
  return Boolean(env('SMTP_HOST'));
}
