import { diaryById, diaryForService, parseDiaryId, type DiaryId } from './config';
import { formatSlotRange, isSlotInPast, isWeekday } from './dates';
import { listBookingsOnDate } from './db';

export function getSlotsForDate(date: string, diaryId: DiaryId = 'mot') {
  const diary = diaryById(diaryId);
  const booked = listBookingsOnDate(date, diaryId);
  const takenByTime = new Map<string, number>();
  for (const booking of booked) {
    takenByTime.set(booking.time, (takenByTime.get(booking.time) ?? 0) + 1);
  }
  const capacity = diary.resources.length;
  const openDay = isWeekday(date);

  return diary.slotTimes.map((time) => {
    const past = isSlotInPast(date, time);
    const taken = takenByTime.get(time) ?? 0;
    const bookedOut = taken >= capacity;
    return {
      time,
      label: formatSlotRange(time, diary.durationMinutes),
      available: openDay && !past && !bookedOut,
      remaining: Math.max(0, capacity - taken),
      reason: !openDay ? 'closed' : past ? 'past' : bookedOut ? 'booked' : null,
    };
  });
}

export function slotsForService(date: string, serviceName: string) {
  return getSlotsForDate(date, diaryForService(serviceName));
}

export function parseDiaryParam(value: string | null | undefined): DiaryId {
  return parseDiaryId(value);
}
