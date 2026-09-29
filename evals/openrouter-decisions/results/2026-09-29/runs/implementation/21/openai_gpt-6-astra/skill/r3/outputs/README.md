# Incident urgency

Server-side TypeScript scorer for `{ service, text }` incident reports using
OpenRouter's Decisions API. One `score` question evaluates five ordered levels:

| Urgency | Meaning |
| --- | --- |
| 1 | Routine: no active impact; informational, resolved, cosmetic, or unrelated |
| 2 | Low: minor localized issue with a practical workaround |
| 3 | Moderate: limited degradation or an unclear active problem needing triage |
| 4 | High: major disruption with substantial impact and no practical workaround |
| 5 | Critical: widespread essential-service outage, data loss, or active compromise |

```sh
npm ci
export OPENROUTER_API_KEY='your-key'
echo '{"service":"checkout","text":"Checkout fails for many customers, with no workaround."}' | npm run rate
```

Import into an existing backend:

```ts
import { rateIncident, compareUrgency } from "./src/urgency.js";

const rating = await rateIncident({
  service: "checkout",
  text: "Checkout fails for many customers, with no workaround."
});
// Store rating with the incident. Sort scored dashboard rows highest first:
const sorted = scoredIncidents.toSorted((a, b) => compareUrgency(a.rating, b.rating));
```

`rating.urgency` is an integer from 1 to 5. The API returns an ordinal expectation
from 0 to 4; code rounds to the nearest level and adds one. Half-level ties round
up. These are ordinal levels, not estimates of damage or response time. The raw
score, optional probabilities and confidence, and actual responding model build
are returned and logged. Probability keys remain API indices `"0"` through `"4"`.
Equal urgency ratings preserve the dashboard's existing order. Confidence is not
used as a correctness guarantee or a gating threshold.

Keep this module and the API key on the server. Input validation rejects missing,
blank, or oversized fields (200 characters for service, 12,000 for report), without
calling the model. HTTP calls time out after 15 seconds. Errors propagate: the
caller should keep failed reports visible in an unscored/manual-triage queue and
allow retries. Do not discard them or default them to urgency 1. Human urgency
overrides should take precedence; this score is for dashboard ordering, not an
automatic paging or incident-closing policy.

Only the service name and report text are sent. No service inventory is available,
so the rubric does not assume criticality from a name alone. There are no numeric
SLA rules; if added, parse and compare values in code. Input text is untrusted:
the rubric excludes embedded rating instructions, and adversarial examples are
included in the probes, but those probes cannot establish universal resistance.

Validation:

```sh
npm run check
npm test
npm run probe  # live calls, uses API credits; writes probe-results.json
```

The probe compares pinned candidates from the live catalog with at least 8,192
tokens of advertised context. It records provider metadata, raw probabilities,
latency, and cost for clear levels, ambiguity, unrelated input, negation, attempted
rating manipulation, and empty-input rejection. Entries with zero advertised
context need capacity verification before use. Re-run these probes and your own
incident examples whenever the pinned `DECISION_MODEL` or rubric changes.

The September 29, 2026 comparison is saved in
[`evaluation/model-probes.json`](evaluation/model-probes.json):

| Pinned model | Matching report ratings | Mean latency | Mean cost/report |
| --- | --- | --- | --- |
| `typesafe/jev-1.13-20260917` (selected) | 10/10 | 212 ms | $0.00002382 |
| `upstage/solar-decide-20260928` | 10/10 | 507 ms | $0.00002972 |
| `jaredpalmer/kev-4b-20260924` | 7/10 | 608 ms | $0.00001140 |

All three also passed local empty-input rejection. Jev offers sufficient context
and lower measured cost and latency than Solar; its catalog lists one provider.
Kev missed moderate degradation, unrelated content, and the attempted inflation
of a cosmetic report. These are small synthetic probes, not production accuracy
estimates. In particular, Jev's adversarial critical case returned 3.51 on the
zero-based scale, close to the rounding boundary: preserve human overrides and
evaluate real reports before relying on the ranking operationally.

The client in `src/vendor/decisions.ts` is copied from the OpenRouter Decisions
skill, with an HTTP timeout added. The application uses its request validation,
typed response parsing, and HTTP transport.
