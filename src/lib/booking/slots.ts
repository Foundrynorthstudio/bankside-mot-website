import { SLOT_TIMES } from './config';
import { isSlotInPast, isWeekday } from './dates';
import { listBookingsOnDate } from './db';

export function getSlotsForDate(date: string) {
  const taken = new Set(listBookingsOnDate(date).map((booking) => booking.time));
  const openDay = isWeekday(date);

  return SLOT_TIMES.map((time) => {
    const past = isSlotInPast(date, time);
    const booked = taken.has(time);
    return {
      time,
      available: openDay && !past && !booked,
      reason: !openDay ? 'closed' : past ? 'past' : booked ? 'booked' : null,
    };
  });
}
