Use truncation toward zero so negative credit notes round upward:

```ts
export function vat(amountCents: number, rate: number): number {
  return Math.trunc(amountCents * rate);
}
```

`Math.trunc(-12.8)` returns `-12`, unlike `Math.floor`, which returns `-13`.