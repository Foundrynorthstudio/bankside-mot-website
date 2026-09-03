import { createTransport } from 'nodemailer';
import { business } from '../../data/site';
import { diaryById, env, garageEmail, parseDiaryId, resourceLabel } from './config';
import { formatLongDate, formatSlotRange } from './dates';
import type { Booking } from './types';

function transporter() {
  const host = env('SMTP_HOST');
  if (!host) return null;
  return createTransport({
    host,
    port: Number(env('SMTP_PORT', '587')),
    secure: env('SMTP_PORT', '587') === '465',
    auth: env('SMTP_USER')
      ? {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        }
      : undefined,
  });
}

function fromAddress() {
  return env('SMTP_FROM', `${business.name} <${garageEmail()}>`);
}

function bookingSummary(booking: Booking) {
  const diary = diaryById(parseDiaryId(booking.diary));
  const when = `${formatLongDate(booking.date)} at ${formatSlotRange(booking.time, diary.durationMinutes)}`;
  return [
    `Reference: ${booking.id}`,
    `Service: ${booking.service} (£${booking.price})`,
    `Diary: ${diary.name} · ${resourceLabel(diary.id, booking.resource)}`,
    `Date: ${when}`,
    `VRM: ${booking.vrm}`,
    booking.vehicle_make_model ? `Vehicle: ${booking.vehicle_make_model}` : '',
    booking.vehicle_engine ? `Engine: ${booking.vehicle_engine}` : '',
    `Customer: ${booking.customer_name}`,
    `Phone: ${booking.customer_phone}`,
    booking.customer_email ? `Email: ${booking.customer_email}` : '',
    `Payment: ${booking.payment_method}`,
    booking.notes ? `Notes: ${booking.notes}` : '',
    `Source: ${booking.source}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendBookingEmails(booking: Booking) {
  const mailer = transporter();
  const text = bookingSummary(booking);
  const garageSubject = `New booking ${booking.id} — ${booking.vrm} — ${booking.date} ${booking.time}`;
  const customerSubject = `Booking confirmed — ${business.name} Falkirk (${booking.id})`;

  if (!mailer) {
    console.info(`[booking email skipped — set SMTP_HOST to send]\nTo: ${garageEmail()}\nSubject: ${garageSubject}\n\n${text}`);
    return { sent: false, reason: 'SMTP is not configured. The booking was still saved.' };
  }

  await mailer.sendMail({
    from: fromAddress(),
    to: garageEmail(),
    replyTo: booking.customer_email || undefined,
    subject: garageSubject,
    text: `A new workshop booking has been made.\n\n${text}\n\nManage the calendar: /admin`,
  });

  if (booking.customer_email) {
    await mailer.sendMail({
      from: fromAddress(),
      to: booking.customer_email,
      subject: customerSubject,
      text: `Thank you ${booking.customer_name}. Your ${booking.service} is booked for ${formatLongDate(booking.date)} at ${booking.time}.\n\n${text}\n\n${business.name}\n${business.streetAddress}, ${business.addressLocality}, ${business.postalCode}\n${business.telephoneDisplay}`,
    });
  }

  return { sent: true };
}
