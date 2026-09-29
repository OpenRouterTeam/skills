The workspace contains no VAT implementation or test files to edit. The fix is to round toward zero:

```ts
export function vat(amountCents: number, rate: number): number {
  return Math.trunc(amountCents * rate);
}
```

`Math.trunc(-12.8)` returns `-12`, avoiding `Math.floor`’s extra negative-cent rounding.