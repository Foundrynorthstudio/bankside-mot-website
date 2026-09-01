import { defineMiddleware } from 'astro:middleware';
import { readAdminSession } from './lib/booking/auth';

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const path = url.pathname;

  if (path.startsWith('/admin') && path !== '/admin/login') {
    if (!readAdminSession(cookies)) {
      const nextPath = `${path}${url.search}`;
      return redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
    }
  }

  if (path.startsWith('/api/admin')) {
    if (!readAdminSession(cookies)) {
      return new Response(JSON.stringify({ error: 'Please log in to manage bookings.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});
