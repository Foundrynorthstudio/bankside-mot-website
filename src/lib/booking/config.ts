export const TIMEZONE = 'Europe/London';

export const SLOT_TIMES = ['08:30', '09:45', '11:00', '13:30', '14:45', '16:00'] as const;

export const BOOKING_HORIZON_DAYS = 56;
export const SAME_DAY_BUFFER_MINUTES = 30;

export const SERVICES = [
  { id: 'class-4-mot', name: 'Class 4 MOT', price: 40 },
  { id: 'class-7-mot', name: 'Class 7 MOT', price: 50 },
  { id: 'interim-service', name: 'Interim Service', price: 120 },
  { id: 'major-service', name: 'Major Service', price: 185 },
  { id: 'diagnostic-scan', name: 'Diagnostic Scan', price: 45 },
  { id: 'mot-major-combo', name: 'MOT + Major Service Combo', price: 205 },
] as const;

export type ServiceName = (typeof SERVICES)[number]['name'];

export const PAYMENT_METHODS = ['Pay at Garage', '0% Payment Assist'] as const;

export const ACTIVE_STATUSES = ['confirmed', 'blocked', 'completed'] as const;

export function serviceByName(name: string) {
  return SERVICES.find((service) => service.name === name);
}

export function env(name: string, fallback = '') {
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  const value = fromMeta || fromProcess;
  return value && value.length > 0 ? value : fallback;
}

export function garageEmail() {
  return env('GARAGE_EMAIL', 'bookings@banksidemot.co.uk');
}
