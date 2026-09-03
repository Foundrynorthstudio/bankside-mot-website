import type { APIRoute } from 'astro';
import { maxBookableDate, todayISO } from '../../lib/booking/dates';
import { diaryForService, parseDiaryId } from '../../lib/booking/config';
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

  const service = url.searchParams.get('service');
  const diaryId = service ? diaryForService(service) : parseDiaryId(url.searchParams.get('diary'));
  return Response.json({ date, diary: diaryId, slots: getSlotsForDate(date, diaryId) });
};
