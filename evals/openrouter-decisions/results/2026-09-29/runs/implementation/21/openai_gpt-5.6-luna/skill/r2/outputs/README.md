# Incident urgency decision model

`rateIncident({ service, report })` sends the report to OpenRouter's Decisions API and returns a dashboard-ready urgency from 1 (lowest) to 5 (highest), plus the raw probability distribution, confidence, resolved model, and decision ID.

Set `OPENROUTER_API_KEY` before running it. The default is the pinned `typesafe/jev-1.13-20260917` build; set `DECISION_MODEL` only after probing a replacement with representative incidents.

```ts
import { rateIncident } from "./dist/src/urgency.js";

const result = await rateIncident({
  service: "payments-api",
  report: "Checkout is returning 503s for most customers; no workaround is known.",
});
console.log(result.urgency, result.probabilities);
```

Run `npm test` to compile and execute the request-shape/response-validation tests. The tests mock the network; a live probe requires an API key.
