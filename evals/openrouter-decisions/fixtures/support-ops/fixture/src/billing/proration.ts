export type Plan = { id: string; monthlyCents: number };

const MS_PER_DAY = 86_400_000;

function daysInMonth(date: Date): number {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate();
}

export function prorateUpgrade(from: Plan, to: Plan, changedAt: Date, periodEnd: Date): number {
  if (to.monthlyCents <= from.monthlyCents) return 0;
  const remainingDays = Math.ceil((periodEnd.getTime() - changedAt.getTime()) / MS_PER_DAY);
  const fraction = Math.min(1, Math.max(0, remainingDays / daysInMonth(changedAt)));
  return Math.round((to.monthlyCents - from.monthlyCents) * fraction);
}

export function isInGracePeriod(periodEnd: Date, now: Date, graceDays: number): boolean {
  return now.getTime() > periodEnd.getTime() && now.getTime() <= periodEnd.getTime() + graceDays * MS_PER_DAY;
}
