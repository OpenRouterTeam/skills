Use `Math.trunc`, which rounds toward zero for both positive and negative amounts:

```ts
export function vat(amountCents: number, rate: number): number {
  return Math.trunc(amountCents * rate);
}
```

The repository contains no VAT source file to modify, so no workspace change was made.