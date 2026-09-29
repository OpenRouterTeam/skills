No matching source file is in the workspace, so here’s the fix:

```ts
export function vat(amountCents: number, rate: number): number {
  return Math.round(amountCents * rate);
}
```

Why: `Math.floor` rounds negative fractional VAT downward—away from zero—so credit notes get an exaggerated credit. `Math.round` applies ordinary half-up rounding to both positive and negative amounts. For example, with a result of `-16.5`, it returns `-17` rather than `Math.floor`’s `-18`; if you need symmetric half-away-from-zero rounding instead, use `Math.trunc(amountCents * rate + Math.sign(amountCents) * 0.5)`.