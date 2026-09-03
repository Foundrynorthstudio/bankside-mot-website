export const TIMEZONE = 'Europe/London';

export const BOOKING_HORIZON_DAYS = 56;
export const SAME_DAY_BUFFER_MINUTES = 30;

export type DiaryId = 'mot' | 'service';

export const DIARIES = {
  mot: {
    id: 'mot' as const,
    name: 'MOT',
    blurb: 'Hourly tests from 08:30 to 16:00',
    durationMinutes: 60,
    slotTimes: ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:00'],
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

export const SERVICES = [
  { id: 'class-4-mot', name: 'Class 4 MOT', price: 40, diary: 'mot' as const },
  { id: 'class-7-mot', name: 'Class 7 MOT', price: 50, diary: 'mot' as const },
  { id: 'interim-service', name: 'Interim Service', price: 120, diary: 'service' as const },
  { id: 'major-service', name: 'Major Service', price: 185, diary: 'service' as const },
  { id: 'diagnostic-scan', name: 'Diagnostic Scan', price: 45, diary: 'service' as const },
  { id: 'mot-major-combo', name: 'MOT + Major Service Combo', price: 205, diary: 'service' as const },
] as const;

export type ServiceName = (typeof SERVICES)[number]['name'];

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

export function diaryForService(serviceName: string): DiaryId {
  return serviceByName(serviceName)?.diary ?? 'service';
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
