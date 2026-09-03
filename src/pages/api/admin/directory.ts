import type { APIRoute } from 'astro';
import { searchBookingDirectory } from '../../../lib/booking/directory';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const query = url.searchParams.get('q') ?? '';
  return Response.json({ matches: searchBookingDirectory(query) });
};
