import type { Urgency } from "./urgency";

const FIRST_RESPONSE_HOURS: Record<Urgency, number> = { 5: 1, 4: 4, 3: 8, 2: 24, 1: 72 };

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;

function isBusinessHour(date: Date): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  return day >= 1 && day <= 5 && hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

export function responseDeadline(openedAt: Date, urgency: Urgency): Date {
  let remaining = FIRST_RESPONSE_HOURS[urgency];
  const cursor = new Date(openedAt.getTime());
  if (urgency === 5) return new Date(cursor.getTime() + remaining * 3_600_000);
  while (remaining > 0) {
    cursor.setTime(cursor.getTime() + 3_600_000);
    if (isBusinessHour(cursor)) remaining -= 1;
  }
  return cursor;
}

export function isBreached(openedAt: Date, urgency: Urgency, firstResponseAt: Date | null, now: Date): boolean {
  const deadline = responseDeadline(openedAt, urgency);
  const effective = firstResponseAt ?? now;
  return effective.getTime() > deadline.getTime();
}
