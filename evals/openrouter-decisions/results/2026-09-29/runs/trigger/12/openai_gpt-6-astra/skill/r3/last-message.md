Use `Math.trunc` to round toward zero, preserving the existing behavior for positive amounts:

```ts
export function vat(amountCents: number, rate: number): number {
  return Math.trunc(amountCents * rate);
}
```

For example, `-10.5` becomes `-10` instead of `-11`, so credit notes mirror positive charges.