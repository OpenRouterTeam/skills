Wrote `subscription-check.ts:7` — `checkSubscription(subscriptionStartDate, cancellationReason)`.

**How it works**
- **Code owns** the date arithmetic: parses the start date, compares against `now - 1 year`, and short-circuits before calling the model if the subscription is under a year old.
- **Decision model owns** the judgment: a single `noul` question asks whether the cancellation reason suggests the customer is likely to subscribe again, with criteria distinguishing temporary/situational from permanent/relational reasons.
- **Gated in code** at `LIKELY_RETURN_THRESHOLD = 0.5` (line 3); the raw probability is also returned as `returnProbability` for downstream use.

**Model:** `typesafe/jev-1.13-20260917` (pinned canonical slug). Probed with three representative cases — temporary budget freeze scored 0.75, competitor switch scored 0.02, ambiguous vendor switch scored 0.46 (just under the gate, correctly conservative). TypeScript compiles clean under strict mode.