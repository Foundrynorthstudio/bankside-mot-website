import { BOOKING_HORIZON_DAYS, SAME_DAY_BUFFER_MINUTES, SLOT_TIMES, TIMEZONE } from './config';

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDaysISO(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  return new Date(utc).toISOString().slice(0, 10);
}

export function weekdayIndex(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekday(isoDate: string) {
  const day = weekdayIndex(isoDate);
  return day >= 1 && day <= 5;
}

export function mondayOfWeek(isoDate: string) {
  const day = weekdayIndex(isoDate);
  const offset = day === 0 ? -6 : 1 - day;
  return addDaysISO(isoDate, offset);
}

export function weekdaysFrom(mondayISO: string) {
  return [0, 1, 2, 3, 4].map((offset) => addDaysISO(mondayISO, offset));
}

export function formatDayHeading(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatLongDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function nowMinutesLondon(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export function timeToMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function maxBookableDate(now = new Date()) {
  return addDaysISO(todayISO(now), BOOKING_HORIZON_DAYS);
}

export function isSlotInPast(date: string, time: string, now = new Date()) {
  const today = todayISO(now);
  if (date < today) return true;
  if (date > today) return false;
  return timeToMinutes(time) < nowMinutesLondon(now) + SAME_DAY_BUFFER_MINUTES;
}

export function isValidSlotTime(time: string) {
  return (SLOT_TIMES as readonly string[]).includes(time);
}
