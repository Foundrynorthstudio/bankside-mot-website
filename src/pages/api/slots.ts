import type { APIRoute } from 'astro';
import { maxBookableDate, todayISO } from '../../lib/booking/dates';
import { getSlotsForDate } from '../../lib/booking/slots';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const date = url.searchParams.get('date') ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Invalid date.' }, { status: 400 });
  }
  if (date < todayISO() || date > maxBookableDate()) {
    return Response.json({ error: 'Date is outside the booking window.' }, { status: 400 });
  }

  return Response.json({ date, slots: getSlotsForDate(date) });
};
