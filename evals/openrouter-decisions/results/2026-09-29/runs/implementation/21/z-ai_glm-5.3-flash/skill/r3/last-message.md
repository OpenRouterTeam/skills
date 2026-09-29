Implemented and tested. Typecheck and all 5 unit tests pass.

- `src/incident-urgency.ts:1` — sends a single `score` question to OpenRouter's Decisions API, with a five-level urgency rubric and the affected service as state. Pins the canonical model (`typesafe/jev-1.13-20260917`).
- `src/incident-urgency.ts:113` — rounds the model's probability-weighted score to the nearest integer level (1–5) rather than trusting it as a raw magnitude.
- `src/incident-urgency.ts:169` — applies a code-side hard rule: text declaring an "outage", "down", or "unavailable" always rates 5 regardless of model output.
- `src/incident-urgency.ts:186` — `rateIncident` handles the API call, validates the response shape, and throws on malformed answers instead of defaulting.
- `src/incident-urgency.ts:199` — `sortForOnCallDashboard` sorts by descending urgency with model confidence as a tie-break.
- `src/incident-urgency.test.ts:1` — five tests covering request shape, score rounding, malformed-answer rejection, the outage hard rule, and dashboard ordering.

Requires `OPENROUTER_API_KEY` in the server environment.