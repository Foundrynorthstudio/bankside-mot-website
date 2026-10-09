import { createTransport } from 'nodemailer';
import { business } from '../../data/site';
import { COMBO_COLLECTION_NOTE, diaryById, env, formatPriceForBooking, garageEmail, isMorningDropOffService, parseDiaryId, resourceLabel } from './config';
import { formatBookingSlotLabel, formatLongDate } from './dates';
import { getEmailTemplate, renderEmailTemplate } from './email-templates';
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
  const when = `${formatLongDate(booking.date)} · ${formatBookingSlotLabel(booking.service, booking.time, diary.id)}`;
  const comboNote = isMorningDropOffService(booking.service) ? COMBO_COLLECTION_NOTE : '';
  return [
    `Reference: ${booking.id}`,
    `Service: ${booking.service} (${formatPriceForBooking(booking.service, booking.price)})`,
    `Diary: ${diary.name} · ${resourceLabel(diary.id, booking.resource)}`,
    `Date: ${when}`,
    comboNote,
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

function bookingFields(booking: Booking): Record<string, string> {
  const diary = diaryById(parseDiaryId(booking.diary));
  const time = formatBookingSlotLabel(booking.service, booking.time, diary.id);
  const date = formatLongDate(booking.date);
  return {
    booking_id: booking.id,
    customer_name: booking.customer_name,
    customer_email: booking.customer_email,
    customer_phone: booking.customer_phone,
    phone: booking.customer_phone,
    service: booking.service,
    price: formatPriceForBooking(booking.service, booking.price),
    date,
    time,
    when: `${date} · ${time}`,
    date_iso: booking.date,
    time_raw: booking.time,
    vrm: booking.vrm,
    vehicle: booking.vehicle_make_model,
    engine: booking.vehicle_engine,
    diary: diary.name,
    resource: resourceLabel(diary.id, booking.resource),
    payment_method: booking.payment_method,
    notes: booking.notes,
    source: booking.source,
    combo_note: isMorningDropOffService(booking.service) ? COMBO_COLLECTION_NOTE : '',
    booking_summary: bookingSummary(booking),
    garage_name: business.name,
    garage_address: `${business.streetAddress}, ${business.addressLocality}, ${business.postalCode}`,
    garage_phone: business.telephoneDisplay,
  };
}

export async function sendBookingEmails(booking: Booking) {
  const mailer = transporter();
  const fields = bookingFields(booking);
  const garage = await getEmailTemplate('garage_booking');
  const customer = await getEmailTemplate('customer_booking');
  const garageSubject = renderEmailTemplate(garage.subject, fields);
  const garageBody = renderEmailTemplate(garage.body, fields);

  if (!mailer) {
    console.info(`[booking email skipped — set SMTP_HOST to send]\nTo: ${garageEmail()}\nSubject: ${garageSubject}\n\n${garageBody}`);
    return { sent: false, reason: 'SMTP is not configured. The booking was still saved.' };
  }

  await mailer.sendMail({
    from: fromAddress(),
    to: garageEmail(),
    replyTo: booking.customer_email || undefined,
    subject: garageSubject,
    text: garageBody,
  });

  if (booking.customer_email) {
    await mailer.sendMail({
      from: fromAddress(),
      to: booking.customer_email,
      subject: renderEmailTemplate(customer.subject, fields),
      text: renderEmailTemplate(customer.body, fields),
    });
  }

  return { sent: true };
}

export async function sendCallbackEmail(input: { name: string; phone: string; message: string }) {
  const mailer = transporter();
  const callbackSummary = [
    `Name: ${input.name}`,
    `Phone: ${input.phone}`,
    input.message ? `Message: ${input.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const fields = {
    customer_name: input.name,
    phone: input.phone,
    message: input.message,
    callback_summary: callbackSummary,
    garage_name: business.name,
    garage_phone: business.telephoneDisplay,
  };
  const template = await getEmailTemplate('callback');
  const subject = renderEmailTemplate(template.subject, fields);
  const body = renderEmailTemplate(template.body, fields);

  if (!mailer) {
    console.info(`[callback email skipped — set SMTP_HOST to send]\nTo: ${garageEmail()}\n\n${body}`);
    return { sent: false, reason: 'The workshop has your number. Email sending is not configured yet, so please also call 01324 613007 if it is urgent.' };
  }

  await mailer.sendMail({
    from: fromAddress(),
    to: garageEmail(),
    subject,
    text: body,
  });
  return { sent: true };
}
