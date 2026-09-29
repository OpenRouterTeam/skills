export function vat(amountCents: number, rate: number): number {
  const exactVat = amountCents * rate;
  return amountCents < 0 ? -Math.floor(-exactVat) : Math.floor(exactVat);
}
