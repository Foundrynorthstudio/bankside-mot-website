export const TIMEZONE = 'Europe/London';

export const BOOKING_HORIZON_DAYS = 56;
export const SAME_DAY_BUFFER_MINUTES = 30;

export type DiaryId = 'mot' | 'service';

export const DIARIES = {
  mot: {
    id: 'mot' as const,
    name: 'MOT',
    blurb: '45-minute tests from 08:30, last slot 16:00',
    durationMinutes: 45,
    slotTimes: ['08:30', '09:15', '10:00', '10:45', '11:30', '12:15', '13:00', '13:45', '14:30', '15:15', '16:00'],
    resources: [{ id: 'bay', label: 'MOT bay' }],
  },
  service: {
    id: 'service' as const,
    name: 'Services',
    blurb: 'Two-hour slots across two mechanics',
    durationMinutes: 120,
    slotTimes: ['08:30', '10:30', '12:30', '14:30'],
    resources: [
      { id: 'mech-1', label: 'Mechanic 1' },
      { id: 'mech-2', label: 'Mechanic 2' },
    ],
  },
} as const;

export type Diary = (typeof DIARIES)[DiaryId];

export const MORNING_DROP_OFF_TIMES = ['08:30', '09:15'] as const;

export const COMBO_COLLECTION_NOTE =
  'Drop the vehicle off in the morning and leave it with us until the end of the day, or collect the following morning.';

export const SERVICES = [
  { id: 'class-4-mot', name: 'Class 4 MOT', price: 50, diary: 'mot' as const, public: true, from: false, bookOnline: true, slotKind: 'hourly' as const },
  { id: 'class-7-mot', name: 'Class 7 MOT', price: 50, diary: 'mot' as const, public: false, from: false, bookOnline: false, slotKind: 'hourly' as const },
  { id: 'interim-service', name: 'Interim Service', price: 175, diary: 'service' as const, public: true, from: true, bookOnline: false, slotKind: 'hourly' as const },
  { id: 'major-service', name: 'Major Service', price: 260, diary: 'service' as const, public: true, from: true, bookOnline: false, slotKind: 'hourly' as const },
  { id: 'diagnostic-scan', name: 'Diagnostic Scan', price: 45, diary: 'service' as const, public: true, from: true, bookOnline: false, slotKind: 'hourly' as const },
  { id: 'mot-major-combo', name: 'MOT + Major Service Combo', price: 310, diary: 'mot' as const, public: true, from: true, bookOnline: true, slotKind: 'morning-dropoff' as const },
] as const;

export type ServiceName = (typeof SERVICES)[number]['name'];

export const BOOKABLE_SERVICES = SERVICES.filter((service) => service.public && service.bookOnline);

export function isMorningDropOffService(name: string) {
  return serviceByName(name)?.slotKind === 'morning-dropoff';
}

export function isMorningDropOffTime(time: string) {
  return (MORNING_DROP_OFF_TIMES as readonly string[]).includes(time);
}

export function formatServicePrice(service: (typeof SERVICES)[number]) {
  return service.from ? `From £${service.price}` : `£${service.price}`;
}

export const PAYMENT_METHODS = ['Pay at Garage', '0% Payment Assist'] as const;

export const ACTIVE_STATUSES = ['confirmed', 'blocked', 'completed'] as const;

export function parseDiaryId(value: string | null | undefined): DiaryId {
  return value === 'service' ? 'service' : 'mot';
}

export function diaryById(id: DiaryId): Diary {
  return DIARIES[id];
}

export function serviceByName(name: string) {
  return SERVICES.find((service) => service.name === name);
}

export function formatPriceForBooking(serviceName: string, price: number) {
  const service = serviceByName(serviceName);
  return service?.from ? `From £${price}` : `£${price}`;
}

export function diaryForService(serviceName: string): DiaryId {
  return serviceByName(serviceName)?.diary ?? 'mot';
}

export function servicesForDiary(diaryId: DiaryId) {
  return SERVICES.filter((service) => service.diary === diaryId);
}

export function resourceLabel(diaryId: DiaryId, resourceId: string) {
  return diaryById(diaryId).resources.find((resource) => resource.id === resourceId)?.label ?? resourceId;
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
