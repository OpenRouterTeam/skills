Fixed in `vat.ts:1` by rounding negative VAT symmetrically with positive amounts:

```ts
export function vat(amountCents: number, rate: number): number {
  const exactVat = amountCents * rate;
  return amountCents < 0 ? -Math.floor(-exactVat) : Math.floor(exactVat);
}
```

Example: for `-100 * 0.2`, this now returns `-20` instead of `-21`.