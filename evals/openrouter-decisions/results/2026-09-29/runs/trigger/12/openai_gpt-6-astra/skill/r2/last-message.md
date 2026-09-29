Use `Math.trunc` to round toward zero, preserving the existing behavior for positive amounts while making credit notes symmetric:

```ts
export function vat(amountCents: number, rate: number): number {
  return Math.trunc(amountCents * rate);
}
```

For example, `109 * 0.2` becomes `21`, and `-109 * 0.2` becomes `-21` instead of `-22`.