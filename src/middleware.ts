import { defineMiddleware } from 'astro:middleware';
import { readAdminSession } from './lib/booking/auth';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com",
    "frame-src https://maps.google.com https://www.google.com",
  ].join('; '),
};

function withSecurityHeaders(response: Response, path: string) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (path.startsWith('/api/')) {
    headers.set('Cache-Control', 'no-store');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const path = url.pathname;

  if (path.startsWith('/admin') && path !== '/admin/login') {
    if (!readAdminSession(cookies)) {
      const nextPath = `${path}${url.search}`;
      return withSecurityHeaders(redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`), path);
    }
  }

  if (path.startsWith('/api/admin')) {
    if (!readAdminSession(cookies)) {
      return withSecurityHeaders(
        new Response(JSON.stringify({ error: 'Please log in to manage bookings.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }),
        path,
      );
    }
  }

  return withSecurityHeaders(await next(), path);
});
