import type { APIRoute } from 'astro';
import { maxBookableDate, todayISO } from '../../lib/booking/dates';
import { diaryForService } from '../../lib/booking/config';
import { jsonNoStore } from '../../lib/booking/http';
import { slotsForService } from '../../lib/booking/slots';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date') ?? todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonNoStore({ error: 'Invalid date.' }, 400);
  }
  if (date < todayISO() || date > maxBookableDate()) {
    return jsonNoStore({ error: 'Date is outside the booking window.' }, 400);
  }

  const service = url.searchParams.get('service');
  if (!service) {
    return jsonNoStore({ error: 'Choose a service.' }, 400);
  }
  try {
    return jsonNoStore({ date, diary: diaryForService(service), slots: await slotsForService(date, service) });
  } catch (error) {
    console.error(error);
    return jsonNoStore(
      { error: 'Could not load times. Please call 01324 613007.' },
      503,
    );
  }
};
