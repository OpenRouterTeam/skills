# support-ops-tickets_urgency-z-ai_glm-5.3-flash-r3

Site: `src/tickets/urgency.ts`

Brief given to both authors:

> Replace the chat-completion call and regex parsing in rateUrgency() with a decision model, keeping the same 1 to 5 urgency output and the existing rule that free-plan tickets never rate 5.

## Candidate B

### Design

```json
{
  "questions": {
    "urgency": {
      "type": "score",
      "instructions": "Rate the urgency of this support ticket from 1 (no rush) to 5 (production down, revenue impact, or security incident).",
      "criteria": [
        "1 - No rush: a question, feature request, or minor annoyance that can wait for the next release.",
        "2 - Low: a small inconvenience with an easy workaround and no business impact.",
        "3 - Moderate: degraded experience or blocked work, but a workaround exists and there is no revenue impact.",
        "4 - High: something important is broken with no workaround, or many users are affected.",
        "5 - Critical: production is down, revenue is being lost right now, or there is a security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return {\n  ticket_id: input.id,\n  subject: input.subject,\n  body: input.body,\n  customer_plan: input.customerPlan\n};",
  "decide_js": "const a = answers.urgency;\nif (!a || a.type !== 'score') {\n  throw new Error('urgency answer missing or has unexpected type' + (a ? ': ' + a.type : ''));\n}\nlet level = NaN;\nif (a.probabilities && typeof a.probabilities === 'object') {\n  let bestKey = null;\n  let bestP = -Infinity;\n  for (const k of Object.keys(a.probabilities)) {\n    const p = Number(a.probabilities[k]);\n    if (Number.isFinite(p) && p > bestP) {\n      bestP = p;\n      bestKey = k;\n    }\n  }\n  if (bestKey !== null) level = Number(bestKey);\n}\nif (!Number.isFinite(level)) {\n  level = Math.round(Number(a.score));\n}\nif (!Number.isFinite(level)) {\n  throw new Error('urgency answer has no usable score or probabilities');\n}\nlevel = Math.max(0, Math.min(4, level));\nlet urgency = level + 1;\nif (urgency === 5 && input.customerPlan === 'free') {\n  urgency = 4;\n}\nreturn String(urgency);",
  "notes": "The decision model judges ticket urgency from the subject, body, and plan context via a single score question whose five ordered criteria map levels 0-4 to urgency 1-5 (lowest level first, per the API contract, with the numeric label embedded in each criterion so the mapping is explicit). decide_js validates that answers.urgency exists and has type 'score', throwing on a missing key or unexpected type rather than silently defaulting, per the Decisions error-handling guidance (the old regex fallback to 3 is intentionally dropped since answers are now structured). It then picks the most likely level from the optional probabilities map when present (ties go to the lowest level; falls back to Math.round of the continuous score when probabilities are absent), clamps the level to 0-4, adds 1 to recover the 1-5 scale, and enforces the existing business rule in deterministic code: a free-plan ticket rated 5 is capped to 4, exactly mirroring the original post-processing. This is one Decisions API request per ticket with no regex parsing."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket_id": "T-2210",
      "subject": "Production API returning 500 for all requests",
      "body": "Since 09:10 UTC every call to /v1/orders returns 500. Our checkout is down and we are losing sales. Enterprise account.",
      "customer_plan": "enterprise"
    },
    "answers": {
      "urgency": {
        "type": "score",
        "score": 3.99,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 1
        },
        "legend": {
          "0": "1 - No rush: a question, feature request, or minor annoyance that can wait for the next release.",
          "1": "2 - Low: a small inconvenience with an easy workaround and no business impact.",
          "2": "3 - Moderate: degraded experience or blocked work, but a workaround exists and there is no revenue impact.",
          "3": "4 - High: something important is broken with no workaround, or many users are affected.",
          "4": "5 - Critical: production is down, revenue is being lost right now, or there is a security incident."
        },
        "confidence": 0.99
      }
    },
    "action": "5",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "ticket_id": "T-2211",
      "subject": "Dark mode?",
      "body": "Any plans for a dark mode in the dashboard? Not urgent, just curious.",
      "customer_plan": "free"
    },
    "answers": {
      "urgency": {
        "type": "score",
        "score": 0.01,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0
        },
        "legend": {
          "0": "1 - No rush: a question, feature request, or minor annoyance that can wait for the next release.",
          "1": "2 - Low: a small inconvenience with an easy workaround and no business impact.",
          "2": "3 - Moderate: degraded experience or blocked work, but a workaround exists and there is no revenue impact.",
          "3": "4 - High: something important is broken with no workaround, or many users are affected.",
          "4": "5 - Critical: production is down, revenue is being lost right now, or there is a security incident."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
