export function vat(amountCents: number, rate: number): number {
  return Math.round(amountCents * rate);
}
