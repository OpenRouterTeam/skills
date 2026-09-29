# Incident urgency rating

`src/incident-urgency.ts` rates free-text incident reports from `1` (no operational impact) to `5` (critical outage or immediate harm) so the on-call dashboard can sort them.

The judgment is sent to OpenRouter's Decisions API as a single `score` question over five ordered levels. Code validates the response and rounds the returned probability-weighted position to the nearest declared level. A declared outage is a code-side hard rule and always gets level `5`. A malformed answer throws rather than inventing a middle rating; if the caller wants a queue-wide guarantee, it can catch the error and use the exported `FALLBACK_URGENCY`.

Set `OPENROUTER_API_KEY` in the server environment. The pinned canonical model is `typesafe/jev-1.13-20260917`; probe it when changing the rubric or model, because probability gates do not transfer between models.

```ts
import { rateIncident, sortForOnCallDashboard } from "./src/incident-urgency.js";

const incidents = await Promise.all([
  rateIncident({ text: "Checkout is down", service: "checkout-api" }),
  rateIncident({ text: "CSV export misses one column", service: "reporting" }),
]);

const ordered = sortForOnCallDashboard(incidents);
```
