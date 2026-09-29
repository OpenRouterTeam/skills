Done. Here's the routing code:

- **`src/leadRouting.ts:1`** — `routeLead(lead)`:
  - **Headcount > 1000** → Enterprise (code, no model call)
  - **Regions ≥ 3** → Enterprise (code, no model call)
  - Otherwise → Jev (`typesafe/jev-1.13-20260917`) judges whether the free text describes a **company-wide rollout**; probability ≥ 0.5 → Enterprise, else SMB.
  - Threshold gate is a named constant (`ROLLOUT_THRESHOLD = 0.5`), set from probe data: clear yes cases scored 0.98–0.99, clear no cases 0.02–0.08, so the margin is wide.
- **`src/leadRoutingDemo.ts:1`** — runnable example showing all three enterprise paths plus an SMB fallback; output confirmed live: BigCo → enterprise (headcount), MultiRegion → enterprise (3+ regions), RolloutCo → enterprise (rollout p=0.99), SmallTeam → smb (p=0.03).
- **`package.json`** — added `@openrouter/sdk` dependency (run `npm install` once to fetch it; it's not committed).

The Jev call is only made when headcount and region rules don't already decide the segment, so deterministic paths skip the model entirely.