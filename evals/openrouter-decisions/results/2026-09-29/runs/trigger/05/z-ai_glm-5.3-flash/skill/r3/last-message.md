**Candidates**

- **`triage.ts` keyword router** — Maps free-text tickets to bounded categories via keywords; pure judgment over unstructured input that probabilities could route, defer, or escalate. Better handled by a `choice` decision.
- **`dedupe.ts` token-overlap > 0.6** — A similarity threshold is a heuristic standing in for the real question ("are these the same issue?"). Better as a `noul` per candidate pair with a code-side gate.
- **`approvals.ts` refunds > $50** — Blanket human queue mostly confirms the obvious. Use a `noul` (e.g., "is this refund clearly justified?") to auto-approve clear cases and route uncertain or policy-flagged ones to review.
- **`auth/permissions.ts` role→scope mapping** — Only if the mapping is being used to judge *contextual* access (e.g., "should this role see this record?") from free-form state; a static, declarative table is pure computation and should stay as-is.
- **`tax.ts` VAT table** — Not a candidate. Country→rate lookup is a deterministic field read; no judgment involved.

**Not candidates (for contrast)**: arithmetic, date ordering, and threshold comparisons on already-parsed values all belong in code.