import type { APIRoute } from 'astro';
import { searchBookingDirectory } from '../../../lib/booking/directory';
import { jsonNoStore } from '../../../lib/booking/http';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q') ?? '';
  return jsonNoStore({ matches: await searchBookingDirectory(query) });
};
