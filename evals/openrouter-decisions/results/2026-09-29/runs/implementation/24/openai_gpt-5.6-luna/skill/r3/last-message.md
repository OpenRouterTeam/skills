I’d use TypeSafe Jev 1.13 for a support-ticket intent classifier. The live catalog reports a 32k context window, $0.042/M input tokens, and a versioned build with 100% recent uptime.

Pin the canonical build—not the moving alias:

```json
{
  "decision_model": "typesafe/jev-1.13-20260917",
  "intent_auto_route_probability": 0.85,
  "intent_min_margin": 0.15,
  "fallback": "human_review"
}
```

Example Decisions request:

```json
{
  "model": "typesafe/jev-1.13-20260917",
  "state": {
    "ticket": {
      "subject": "I was charged twice",
      "body": "I see two completed charges for the same order."
    }
  },
  "questions": {
    "intent": {
      "type": "choice",
      "instructions": "What is the primary intent of this support ticket?",
      "criteria": {
        "billing": "Charges, refunds, invoices, payments, or duplicate transactions.",
        "technical_issue": "A product defect or unexpected software behavior.",
        "account_access": "Login, authentication, permissions, or account recovery.",
        "feature_request": "A request for new or changed product functionality.",
        "other": "None of the categories above."
      }
    },
    "needs_human_review": {
      "type": "noul",
      "instructions": "Does this ticket require human review before routing?",
      "criteria": {
        "true": "The ticket is ambiguous, contradictory, sensitive, or cannot be safely assigned from the available information.",
        "false": "The ticket has a clear, safe, single intent."
      }
    }
  }
}
```

The application should route only when the selected intent is sufficiently probable:

```ts
const answer = response.answers.intent;

if (answer.type !== "choice") {
  throw new Error("Unexpected answer type");
}

const probabilities = answer.probabilities ?? {};
const selected = answer.choice;
const selectedProbability = probabilities[selected] ?? 0;

const ranked = Object.values(probabilities).sort((a, b) => b - a);
const margin = (ranked[0] ?? 0) - (ranked[1] ?? 0);

const autoRoute =
  selected !== "other" &&
  selectedProbability >= 0.85 &&
  margin >= 0.15;

const destination = autoRoute ? selected : "human_review";

if (response.model !== "typesafe/jev-1.13-20260917") {
  throw new Error("Decision model is not the pinned build");
}
```

Before shipping, I’d run the exact request over a labeled probe set containing:

- Clear examples of every category
- Ambiguous and multi-intent tickets
- `other` and empty/off-topic inputs
- Negated cases, such as “I was not charged twice”
- Adversarial text that instructs the classifier to choose a label
- Sensitive cases that must reach human review

Using the bundled tooling:

```bash
npx tsx scripts/models.ts request.json
npx tsx scripts/decide.ts request.json \
  --model typesafe/jev-1.13-20260917
```

I’d record each raw probability, chosen label, latency, cost, and exact returned `model`. I would ship only if:

- Clear cases exceed the proposed `0.85` probability gate.
- Clear cases have at least a `0.15` top-two margin.
- Ambiguous, adversarial, and sensitive cases fall into human review.
- No category has unacceptable false auto-routing.
- The pinned model in every response matches the configured build.

If the probe results require different thresholds, update the constants and rerun the full probe set. Any future model change requires repeating this calibration; thresholds do not transfer automatically.