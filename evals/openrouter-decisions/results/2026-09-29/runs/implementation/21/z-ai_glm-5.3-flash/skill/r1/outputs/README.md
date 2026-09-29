# Incident Urgency Scorer

Rates free-text incident reports plus an affected service from 1 (scheduled/cosmetic) to 5 (company-critical emergency) using an OpenRouter Decisions `score` question. The dashboard can sort the returned integer level directly.

## Setup

```bash
npm install
export OPENROUTER_API_KEY=...
```

## Rate a report

```bash
npx tsx src/rate-cli.ts examples/payment-outage.json
```

The CLI returns the integer level and the exact model build that produced it. In production, import `rateIncident(report, apiKey)` from `src/incident-urgency.ts`; the decision model judges impact while application code validates input, calls the pinned model, validates the typed answer, and maps the probability-weighted score to the nearest level.

## Probe before changing the model or rubric

The default pin is `typesafe/jev-1.13-20260917`. Before changing it, rerun the edge-case set:

```bash
cd .agents/skills/openrouter-decisions/scripts && npm install
cd -
npx tsx probe/run.ts probe/cases.json
```

Review each raw score and probability distribution, then update `DECISION_MODEL` or the calibration constants only after the probe produces the routing you want on clear cases, ambiguity, negation, and adversarial wording.
