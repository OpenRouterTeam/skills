# Jev lead routing

```ts
import { routeLead } from "./lead-routing.js";

const route = await routeLead({
  companyName: "Acme",
  headcount: 300,
  regions: ["North America", "Europe"],
  lookingFor: "Start with finance, then deploy to all departments across the company.",
}); // Enterprise
```

Run server-side with `OPENROUTER_API_KEY` in the environment. Install with `npm ci`.
`npm test` checks the rules and failure handling; `npm run typecheck` checks TypeScript.
`npm run probe` makes 11 paid API calls on synthetic examples and saves raw results.

Headcount strictly greater than 1,000 or three distinct regions returns Enterprise without calling Jev. Regions are supplied as an array of canonical names/IDs; whitespace and case are normalized before deduplication. Upstream code must map aliases to the same region ID. Exactly 1,000 employees does not satisfy the headcount rule. Empty free text defaults to SMB when neither structured rule applies.

For other leads, a single `noul` question judges company-wide deployment intent, using only the free text. Company name, headcount, and regions stay out of model state. Code routes probability >= 0.5 to Enterprise and everything below to SMB. Explicit phased company-wide plans qualify; a team pilot or hypothetical future expansion alone does not. API failures or invalid answers throw so callers can retry instead of misrouting the lead.

The live catalog on 2026-09-29 listed `typesafe/jev-1.13-20260917`, with a 32,000-token context and one TypeSafe provider, at $0.042 per million input tokens and no output token cost. That build is pinned in `lead-routing.ts`; the resolved model and raw probability are logged per answer. The client is copied from the OpenRouter Decisions skill's `scripts/lib.ts`.

All 11 synthetic live probes passed at the 0.5 threshold: rollout probabilities were 0.93–0.97 for positive examples and 0.02–0.17 for negative examples, including negation and an adversarial instruction. See `probe-results.json`. These examples establish a working demonstration, not accuracy on your actual leads. Validate the gate on labeled leads and rerun probes when changing the model or rubric. The probe deliberately sends empty text to inspect model behavior; the router skips that call.
