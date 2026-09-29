I’d use Upstage Solar Decide, pinned to the current dated build:

```text
upstage/solar-decide-20260928
```

The live catalog reports 524k context, two Upstage endpoints, 100% recent uptime, and $0.05/M input tokens. I would not use the `upstage/solar-decide` alias in production.

Example job: classify support tickets into an owning queue and independently flag tickets requiring human review.

```json
{
  "model": "upstage/solar-decide-20260928",
  "state": {
    "ticket": {
      "subject": "Charged twice for my subscription",
      "body": "I see two completed charges from today. Please refund one."
    }
  },
  "questions": {
    "queue": {
      "type": "choice",
      "instructions": "Which support queue should own this ticket?",
      "criteria": {
        "billing": "Charges, invoices, refunds, subscriptions, or payment disputes.",
        "technical": "A product defect, outage, error, or broken feature.",
        "account": "Login, identity, permissions, or profile problems.",
        "general": "A valid request that does not fit the other queues.",
        "none": "The ticket is empty, unintelligible, or unrelated to support."
      }
    },
    "needs_human_review": {
      "type": "noul",
      "instructions": "Does this ticket require human review before automated handling?",
      "criteria": {
        "true": "The ticket involves fraud, threats, legal escalation, safety concerns, or materially ambiguous intent.",
        "false": "The ticket is routine and can follow the normal automated workflow."
      }
    }
  }
}
```

Code should own the gates:

```ts
const REVIEW_PROBABILITY = 0.5; // initial default; calibrate before tightening
const MIN_ROUTE_CONFIDENCE = 0.0; // set from probe results, not by guess

if (needsHumanReview.noul >= REVIEW_PROBABILITY) {
  return "human_review";
}

if (queue.confidence < MIN_ROUTE_CONFIDENCE) {
  return "human_review";
}

return queue.choice;
```

Before shipping, I would run the exact request against a labeled probe set containing:

- clear billing, technical, account, and general examples;
- a `none`/off-topic example;
- empty input;
- negated wording, such as “I was not charged twice”;
- ambiguous multi-issue tickets;
- adversarial text that argues for its own label;
- fraud, legal, threat, and safety cases.

For each case, record:

```text
input, expected_queue, expected_review, model, raw probabilities,
choice confidence, latency, and cost
```

Then choose thresholds from observed errors:

- Set the review threshold low enough that every high-cost or safety-sensitive false negative is caught.
- Set the route-confidence threshold high enough that ambiguous tickets fall back to review.
- Verify clear examples are comfortably away from both gates.
- Test the final thresholds on a holdout set that was not used to tune them.
- Re-run the same calibration whenever the pinned model changes.

The current model and endpoint checks justify the pin, but the thresholds should remain provisional until this probe/holdout process has produced measured results.