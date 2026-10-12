import type { APIRoute } from 'astro';
import { createBooking, SlotTakenError } from '../../lib/booking/db';
import { sendBookingEmails } from '../../lib/booking/email';
import { jsonNoStore } from '../../lib/booking/http';
import { consumeRateLimit, rateLimits } from '../../lib/booking/rate-limit';
import { slotsForService } from '../../lib/booking/slots';
import { validatePublicBooking } from '../../lib/booking/validate';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!(await consumeRateLimit('booking', clientAddress, rateLimits.booking.limit, rateLimits.booking.windowMs))) {
    return jsonNoStore({ error: 'Too many booking attempts. Please call the garage.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonNoStore({ error: 'Invalid booking details.' }, 400);
  }

  const { errors, value } = validatePublicBooking({
    service: String(body.service ?? ''),
    date: String(body.date ?? ''),
    time: String(body.time ?? ''),
    vrm: String(body.vrm ?? ''),
    vehicle_make_model: String(body.vehicle_make_model ?? ''),
    vehicle_engine: String(body.vehicle_engine ?? ''),
    customer_name: String(body.customer_name ?? ''),
    customer_phone: String(body.customer_phone ?? ''),
    customer_email: String(body.customer_email ?? ''),
    payment_method: String(body.payment_method ?? 'Pay at Garage'),
    notes: String(body.notes ?? ''),
  }, { publicOnly: true });

  if (errors.length > 0 || !value) {
    return jsonNoStore({ error: errors[0], errors }, 400);
  }

  const slots = await slotsForService(value.date, value.service);
  const slot = slots.find((item) => item.time === value.time);
  if (!slot?.available) {
    return jsonNoStore({ error: 'That time slot is no longer available.', slots }, 409);
  }

  try {
    const booking = await createBooking({ ...value, source: 'online', status: 'confirmed' });
    let emailSent = false;
    try {
      const email = await sendBookingEmails(booking);
      emailSent = email.sent;
    } catch (error) {
      console.error('Booking saved but email failed:', error);
    }

    return jsonNoStore({
      ok: true,
      ref: booking.id,
      emailSent,
      slots: await slotsForService(value.date, value.service),
    });
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return jsonNoStore({ error: error.message, slots: await slotsForService(value.date, value.service) }, 409);
    }
    console.error(error);
    return jsonNoStore({ error: 'Could not save the booking. Please call the garage.' }, 500);
  }
};
