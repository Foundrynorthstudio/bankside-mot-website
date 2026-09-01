export const prerender = false;

import type { APIRoute } from 'astro';
import { clearAdminSession } from '../../lib/booking/auth';

export const POST: APIRoute = ({ cookies, redirect }) => {
  clearAdminSession(cookies);
  return redirect('/admin/login');
};
