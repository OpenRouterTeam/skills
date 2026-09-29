Config written and thresholds trace to live probe numbers. Ready to ship. Done. I picked and pinned a decision model for the new classification job, and wrote the config to `classification-config.yaml:1`.

**Pinned model:** `typesafe/jev-1.13-20260917` (canonical/versioned build, not an alias)

**Why this model:**
- Live catalog probe (2026-09-29): Jev 1.13 returned the sharpest probabilities (`0.95–1.00` on clear cases) at the lowest latency (~200 ms) and lowest cost ($0.000018/call).
- `upstage/solar-decide` and `jaredpalmer/kev-4b` both gave much weaker separation (0.49 / 0.59 top probabilities on the same ambiguous case) and higher latency.
- 32k context, single TypeSafe provider at 100% uptime last 30m.

**Probe set used to set thresholds:**

| Message | `is_billing` noul | `category` top |
|---|---|---|
| "I was charged twice" | 0.99 | payments 1.00 |
| "Do you offer refunds for annual plans?" | 0.96 | payments 1.00 |
| Checkout blank screen (ambiguous) | 0.98 | payments 0.95 |
| "My dashboard is blank on Safari" | 0.02 | frontend 1.00 |
| "I can't log into my account" | 0.02 | account 1.00 |
| "How do I change my profile picture?" | 0.01 | account 0.99 |

**Thresholds set from observed numbers, not defaults:**
- `is_billing` gate at **0.70** — clear yes/no cases sit at ≤ 0.02 or ≥ 0.96, leaving ~0.28 of margin on both sides.
- Category top-option gate at **0.70**, with a 0.45–0.85 review band for anything the probe didn't clearly separate.
- Mistake bias: route to review, never auto-route on a wrong label.

**Confirm before shipping:** rerun the six probe cases verbatim (listed in the config) with `npx tsx decide.ts probe.json --model typesafe/jev-1.13` and check each raw `noul`/probability against the gate. Any drift means either the threshold moves to match the new observed numbers or the model changes — never ship on assumed probabilities.