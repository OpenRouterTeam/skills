# Incident urgency

Server-side TypeScript scorer for `{ service, text }` incident reports. It calls OpenRouter's Decisions API with one ordered `score` question. The default rubric is **1 low, 2 minor, 3 moderate, 4 high, 5 critical**; it judges active operational impact and urgency of response.

```bash
npm ci
export OPENROUTER_API_KEY='your-server-side-key'
echo '{"service":"checkout","text":"Checkout is unavailable for all customers."}' | npm run rate
```

Use the module from an ingestion worker or backend:

```typescript
import { rateIncident, compareUrgency } from "./src/urgency.ts";

const report = { service: "checkout", text: "Customers cannot complete purchases." };
const rating = await rateIncident(report);
// Store rating alongside the incident's ID and report.
// rating.urgency: integer 1–5 for display
// rating.sortScore: fractional 1–5 value for descending dashboard order
// rating.model, rating.probabilities, rating.confidence: audit metadata

const ratedIncidents = [rating /* other stored ratings */];
ratedIncidents.sort(compareUrgency);
```

The API returns a probability-weighted, zero-based level (0–4). Code adds one for `sortScore`, then rounds to the nearest level for `urgency`; halfway ties round upward. Fractional scores break ties within a displayed level. They describe ordinal urgency, not time-to-resolution or a calibrated probability of harm. Confidence is optional distribution concentration and does not trigger a cutoff.

The request contains only service name and report text. Empty fields and reports exceeding 16,000 UTF-8 bytes (service: 256 bytes) are rejected without calling the model. HTTP requests time out after 15 seconds. Missing credentials, HTTP failures, and malformed answers throw: ingestion should retain the original report and put it in a visible **unscored/manual triage queue**, then retry as appropriate. Never translate these errors to urgency 1 or drop the incident. Keep a manual urgency override for on-call staff; this ranking alone should not suppress paging or close incidents.

`rateIncident` logs the resolved model build and rating, without report text, using `console.info` by default. Supply `log` to integrate your structured logger. Keep the API key and execution on the server. No dashboard or persistence layer existed in this workspace; the module exposes the values needed by either.

The model build is pinned in `src/urgency.ts`. See `probes/README.md` for selection evidence and limitations. Adjust the rubric for your operational policy and rerun the probes before changing it or the model.

```bash
npm test
npm run typecheck
npm run probe   # live API calls, requires a key and incurs usage charges
```

`src/vendor/decisions.ts` and the catalog/comparison scripts are copied from the openrouter-decisions skill. The HTTP transport adds a timeout and omits provider error bodies from exceptions.
