export type Payout = { sellerId: string; amountCents: number; earnedAt: string };

const HOLD_DAYS = 7;
const PAYOUT_WEEKDAY = 2; // Tuesday
const MS_PER_DAY = 86_400_000;

export function nextPayoutDate(payout: Payout): string {
  const release = new Date(Date.parse(payout.earnedAt) + HOLD_DAYS * MS_PER_DAY);
  const daysUntil = (PAYOUT_WEEKDAY - release.getUTCDay() + 7) % 7;
  release.setTime(release.getTime() + daysUntil * MS_PER_DAY);
  release.setUTCHours(9, 0, 0, 0);
  return release.toISOString();
}

export function batchBySeller(payouts: Payout[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of payouts) totals.set(p.sellerId, (totals.get(p.sellerId) ?? 0) + p.amountCents);
  return totals;
}
