For a single-label support-ticket classifier, I’d use TypeSafe Jev 1.13. The live catalog reports a 32k context window, $0.042/M input tokens, and 100% provider uptime over the last 30 minutes.

Pin the dated build, not the moving alias:

```yaml
decision_model: typesafe/jev-1.13-20260917
classification: support_ticket_routing
review_on_low_confidence: true
```

Example request:

```json
{
  "model": "typesafe/jev-1.13-20260917",
  "state": {
    "ticket_text": "I was charged twice for my subscription."
  },
  "questions": {
    "queue": {
      "type": "choice",
      "instructions": "Which support queue should own this ticket?",
      "criteria": {
        "billing": "Charges, invoices, refunds, subscriptions, or payment problems.",
        "technical": "A product defect, outage, error, or malfunction.",
        "account": "Login, access, identity, permissions, or profile problems.",
        "other": "No listed queue clearly applies."
      }
    }
  }
}
```

The application should gate the result explicitly:

```ts
const REVIEW_CONFIDENCE = 0.70; // provisional; must be measured

const answer = response.answers.queue;

if (answer.type !== "choice") {
  throw new Error("Unexpected decision answer type");
}

const route =
  answer.confidence !== undefined &&
  answer.confidence >= REVIEW_CONFIDENCE
    ? answer.choice
    : "human_review";
```

`REVIEW_CONFIDENCE` is only a starting value. Before shipping, I would:

1. Build a labeled probe set containing clear examples, ambiguous cases, `other` cases, empty/off-topic inputs, negation, and adversarial text.
2. Run the same request against Jev and any remaining catalog candidates:

```bash
npx tsx scripts/decide.ts probes.json --compare
```

3. For each candidate, record the exact returned `model`, latency, cost, selected label, probabilities, and confidence.
4. Sweep candidate confidence thresholds and measure per-queue precision, coverage, false-route rate, and human-review rate.
5. Choose the lowest threshold that meets the business precision target, with a review fallback for borderline cases.
6. Re-run the full probe set and a held-out labeled set using the pinned build. Any model change requires repeating this calibration.

I would not ship until the chosen threshold is supported by held-out results and the response’s exact `model` remains `typesafe/jev-1.13-20260917`.