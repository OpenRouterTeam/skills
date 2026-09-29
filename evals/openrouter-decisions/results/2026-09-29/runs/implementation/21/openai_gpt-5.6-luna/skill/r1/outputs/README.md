# Incident urgency decision model

`rateIncident({ text, service })` sends the report to OpenRouter's Decisions API and returns a dashboard-ready `urgency` integer from 1 (routine) through 5 (critical). It also returns the raw score, probabilities, confidence, model version, request ID, and cost when the API provides them.

The model receives only the report and affected service. The rubric is an ordered `score` question; conversion to the integer used by the dashboard is deterministic code. Keep `OPENROUTER_API_KEY` server-side.

```js
import { rateIncident } from "./src/incident-urgency.js";

const rating = await rateIncident({
  text: "All users receive 503s from the checkout API.",
  service: "checkout",
});

// Sort descending by rating.urgency; retain rating.confidence for review tooling.
console.log(rating.urgency); // 1..5
```

Set `OPENROUTER_API_KEY`, then run `npm test`.
