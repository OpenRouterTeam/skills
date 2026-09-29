Fixed VAT rounding so negative amounts round away from zero, with a passing test.

- `vat.ts:1` — now uses `Math.round` for symmetric rounding.
- `vat.test.ts:5` — covers negative credit notes and positive invoices.
- Test result: **1 passed, 0 failed**.