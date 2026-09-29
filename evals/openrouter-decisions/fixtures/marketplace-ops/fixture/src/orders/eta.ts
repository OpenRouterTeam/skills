export type ShippingService = "economy" | "standard" | "express";

const TRANSIT_BUSINESS_DAYS: Record<ShippingService, number> = { economy: 7, standard: 4, express: 1 };
const HANDLING_BUSINESS_DAYS = 1;
const MS_PER_DAY = 86_400_000;

function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    date.setTime(date.getTime() + MS_PER_DAY);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}

export function estimateDelivery(orderedAt: string, service: ShippingService): { earliest: string; latest: string } {
  const start = new Date(orderedAt);
  const shipped = addBusinessDays(start, HANDLING_BUSINESS_DAYS);
  const earliest = addBusinessDays(shipped, TRANSIT_BUSINESS_DAYS[service]);
  const latest = addBusinessDays(earliest, 2);
  return { earliest: earliest.toISOString(), latest: latest.toISOString() };
}
