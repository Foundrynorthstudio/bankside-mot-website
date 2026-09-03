import { PAYMENT_METHODS, diaryForService, serviceByName } from './config';
import { isSlotInPast, isValidSlotTime, isWeekday, maxBookableDate, todayISO } from './dates';

const VRM_PATTERN = /^[A-Z0-9]{2,8}$/;
const PHONE_PATTERN = /^[0-9+]{10,16}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseVrm(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalisePhone(value: string) {
  return value.replace(/[\s()-]/g, '');
}

export type PublicBookingPayload = {
  service: string;
  date: string;
  time: string;
  vrm: string;
  vehicle_make_model?: string;
  vehicle_engine?: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  payment_method?: string;
  notes?: string;
};

export function validatePublicBooking(input: PublicBookingPayload, options?: { allowPast?: boolean; requireEmail?: boolean }) {
  const errors: string[] = [];
  const service = serviceByName(input.service);
  if (!service) errors.push('Please choose a valid service.');

  const vrm = normaliseVrm(input.vrm ?? '');
  if (!VRM_PATTERN.test(vrm)) errors.push('Enter a valid UK registration (letters and numbers only).');

  const name = (input.customer_name ?? '').trim();
  if (name.length < 2) errors.push('Enter the customer name.');

  const phone = normalisePhone(input.customer_phone ?? '');
  if (!PHONE_PATTERN.test(phone)) errors.push('Enter a valid phone number.');

  const requireEmail = options?.requireEmail !== false;
  const email = (input.customer_email ?? '').trim().toLowerCase();
  if (requireEmail && !EMAIL_PATTERN.test(email)) errors.push('Enter a valid email address.');
  if (!requireEmail && email && !EMAIL_PATTERN.test(email)) errors.push('Enter a valid email address.');

  const date = (input.date ?? '').trim();
  const time = (input.time ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Choose a booking date.');
  const diaryId = diaryForService(input.service);
  if (!isValidSlotTime(time, diaryId)) errors.push('Choose an available time slot.');
  if (date && !isWeekday(date)) errors.push('Online booking is Monday to Friday only.');
  if (date && (date < todayISO() || date > maxBookableDate())) errors.push('That date is outside the booking window.');
  if (!options?.allowPast && date && time && isSlotInPast(date, time)) errors.push('That time has already passed.');

  const payment = input.payment_method || 'Pay at Garage';
  if (!(PAYMENT_METHODS as readonly string[]).includes(payment as (typeof PAYMENT_METHODS)[number])) {
    errors.push('Choose a payment option.');
  }

  return {
    errors,
    value: service
      ? {
          service: service.name,
          price: service.price,
          date,
          time,
          vrm,
          vehicle_make_model: (input.vehicle_make_model ?? '').trim(),
          vehicle_engine: (input.vehicle_engine ?? '').trim(),
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          payment_method: payment,
          notes: (input.notes ?? '').trim(),
        }
      : null,
  };
}
