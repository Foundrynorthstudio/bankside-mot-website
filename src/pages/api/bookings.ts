import type { APIRoute } from 'astro';
import { diaryForService } from '../../lib/booking/config';
import { createBooking, SlotTakenError } from '../../lib/booking/db';
import { sendBookingEmails } from '../../lib/booking/email';
import { getSlotsForDate } from '../../lib/booking/slots';
import { validatePublicBooking } from '../../lib/booking/validate';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid booking details.' }, { status: 400 });
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
  });

  if (errors.length > 0 || !value) {
    return Response.json({ error: errors[0], errors }, { status: 400 });
  }

  const slots = getSlotsForDate(value.date, diaryForService(value.service));
  const slot = slots.find((item) => item.time === value.time);
  if (!slot?.available) {
    return Response.json({ error: 'That time slot is no longer available.', slots }, { status: 409 });
  }

  try {
    const booking = createBooking({ ...value, source: 'online', status: 'confirmed' });
    let emailSent = false;
    try {
      const email = await sendBookingEmails(booking);
      emailSent = email.sent;
    } catch (error) {
      console.error('Booking saved but email failed:', error);
    }

    return Response.json({
      ok: true,
      ref: booking.id,
      booking,
      emailSent,
      slots: getSlotsForDate(value.date, diaryForService(value.service)),
    });
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return Response.json({ error: error.message, slots: getSlotsForDate(value.date, diaryForService(value.service)) }, { status: 409 });
    }
    console.error(error);
    return Response.json({ error: 'Could not save the booking. Please call the garage.' }, { status: 500 });
  }
};
