Use `Math.trunc` to round toward zero. This preserves positive behavior and makes credit notes symmetric.

```ts
export function vat(amountCents: number, rate: number): number {
  return Math.trunc(amountCents * rate);
}
```

For example, `10.5` becomes `10`, and `-10.5` becomes `-10` instead of `-11`.