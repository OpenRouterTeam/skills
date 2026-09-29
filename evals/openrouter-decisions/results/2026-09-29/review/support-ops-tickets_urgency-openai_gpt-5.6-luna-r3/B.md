# support-ops-tickets_urgency-openai_gpt-5.6-luna-r3

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
      "instructions": "Rate the urgency of this support ticket from 1 (no rush) to 5 (production down, major revenue impact, or a security incident). Consider the severity, scope, customer impact, and whether the issue is actively blocking normal business operations.",
      "criteria": [
        "No rush: informational request, minor inconvenience, or issue with a harmless workaround.",
        "Low urgency: limited impact affecting a small number of users, with a reasonable workaround.",
        "Moderate urgency: meaningful product problem or degraded behavior that should be addressed soon but is not blocking critical operations.",
        "High urgency: serious customer impact, significant degradation, or an important workflow blocked, but not clearly a widespread production outage or major ongoing loss.",
        "Critical urgency: production is down or broadly unusable, revenue is being materially lost, or there is an active security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body, customerPlan: input.customerPlan };",
  "decide_js": "if (!answers || !answers.urgency || answers.urgency.type !== \"score\" || typeof answers.urgency.score !== \"number\" || !Number.isFinite(answers.urgency.score)) throw new Error(\"Invalid urgency decision answer\"); var level = Math.max(1, Math.min(5, Math.round(answers.urgency.score) + 1)); if (input.customerPlan === \"free\" && level === 5) level = 4; return String(level);",
  "notes": "The decision model judges the ticket's urgency using five ordered levels from minor or informational issues through widespread production outages, major revenue impact, or active security incidents. The JavaScript converts the model's zero-based score to the required 1–5 action using nearest-integer rounding, clamps it to the valid range, and downgrades a free-plan ticket from 5 to 4."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "subject": "Production API returning 500 for all requests",
      "body": "Since 09:10 UTC every call to /v1/orders returns 500. Our checkout is down and we are losing sales. Enterprise account.",
      "customerPlan": "enterprise"
    },
    "answers": {
      "urgency": {
        "type": "score",
        "score": 4,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 1
        },
        "legend": {
          "0": "No rush: informational request, minor inconvenience, or issue with a harmless workaround.",
          "1": "Low urgency: limited impact affecting a small number of users, with a reasonable workaround.",
          "2": "Moderate urgency: meaningful product problem or degraded behavior that should be addressed soon but is not blocking critical operations.",
          "3": "High urgency: serious customer impact, significant degradation, or an important workflow blocked, but not clearly a widespread production outage or major ongoing loss.",
          "4": "Critical urgency: production is down or broadly unusable, revenue is being materially lost, or there is an active security incident."
        },
        "confidence": 1
      }
    },
    "action": "5",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "subject": "Dark mode?",
      "body": "Any plans for a dark mode in the dashboard? Not urgent, just curious.",
      "customerPlan": "free"
    },
    "answers": {
      "urgency": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0
        },
        "legend": {
          "0": "No rush: informational request, minor inconvenience, or issue with a harmless workaround.",
          "1": "Low urgency: limited impact affecting a small number of users, with a reasonable workaround.",
          "2": "Moderate urgency: meaningful product problem or degraded behavior that should be addressed soon but is not blocking critical operations.",
          "3": "High urgency: serious customer impact, significant degradation, or an important workflow blocked, but not clearly a widespread production outage or major ongoing loss.",
          "4": "Critical urgency: production is down or broadly unusable, revenue is being materially lost, or there is an active security incident."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
