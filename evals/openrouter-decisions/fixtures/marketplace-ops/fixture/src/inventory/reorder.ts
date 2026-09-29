export type StockRecord = {
  sku: string;
  onHand: number;
  reserved: number;
  dailySales7d: number[];
  leadTimeDays: number;
  safetyDays: number;
};

export function reorderQuantity(record: StockRecord): number {
  const available = record.onHand - record.reserved;
  const dailyRate = record.dailySales7d.reduce((a, b) => a + b, 0) / Math.max(1, record.dailySales7d.length);
  const reorderPoint = Math.ceil(dailyRate * (record.leadTimeDays + record.safetyDays));
  if (available > reorderPoint) return 0;
  const target = Math.ceil(dailyRate * (record.leadTimeDays + record.safetyDays) * 2);
  return Math.max(0, target - available);
}
