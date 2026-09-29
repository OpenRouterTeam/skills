export type TaxRegion = "US-CA" | "US-NY" | "US-TX" | "DE" | "FR" | "GB";

const RATES: Record<TaxRegion, number> = {
  "US-CA": 0.0725,
  "US-NY": 0.04,
  "US-TX": 0.0625,
  DE: 0.19,
  FR: 0.2,
  GB: 0.2,
};

export type LineItem = { sku: string; unitCents: number; quantity: number; taxable: boolean };

export function taxCents(items: LineItem[], region: TaxRegion): number {
  const taxableSubtotal = items.filter((i) => i.taxable).reduce((sum, i) => sum + i.unitCents * i.quantity, 0);
  return Math.round(taxableSubtotal * RATES[region]);
}

export function totalCents(items: LineItem[], region: TaxRegion, discountCents: number): number {
  const subtotal = items.reduce((sum, i) => sum + i.unitCents * i.quantity, 0);
  return Math.max(0, subtotal - discountCents) + taxCents(items, region);
}
