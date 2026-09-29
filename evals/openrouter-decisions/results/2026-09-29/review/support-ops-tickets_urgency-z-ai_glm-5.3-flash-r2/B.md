# support-ops-tickets_urgency-z-ai_glm-5.3-flash-r2

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
      "instructions": "How urgent is this support ticket? Rate from 1 (no rush) to 5 (production down, revenue impact, or security incident).",
      "criteria": [
        "1 - No rush: a question, feature request, or minor issue that can wait for a normal release cycle.",
        "2 - Low: an inconvenience or non-critical bug with a workaround; should be addressed soon but nothing is blocked.",
        "3 - Moderate: a real problem affecting the customer's workflow, but there is a workaround or impact is limited.",
        "4 - High: significant impact, a key feature is broken, or multiple users are affected; needs a fix this week.",
        "5 - Critical: production down, revenue impact right now, data loss, or a security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body, customer_plan: input.customerPlan };",
  "decide_js": "const a = answers.urgency;\nif (!a || a.type !== 'score') return '3';\nlet level = Math.round(a.score);\nif (level < 1) level = 1;\nif (level > 5) level = 5;\nif (level === 5 && input.customerPlan === 'free') level = 4;\nreturn String(level);",
  "notes": "The model judges urgency on a five-level ordered scale mirroring the original prompt's 1-5 rubric (no rush up to production down/revenue/security), using the ticket subject, body, and the customer's plan as state. The score answer returns a continuous score; decide_js rounds it to the nearest integer, clamps to 1-5, and enforces the existing business rule in code: free-plan tickets rated 5 are capped to 4, so the model never needs to know about the rule. If the answer is missing or has an unexpected type, the code falls back to 3, matching the old regex-failure default."
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
      "customer_plan": "enterprise"
    },
    "answers": {
      "urgency": {
        "type": "score",
        "score": 3.98,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 1
        },
        "legend": {
          "0": "1 - No rush: a question, feature request, or minor issue that can wait for a normal release cycle.",
          "1": "2 - Low: an inconvenience or non-critical bug with a workaround; should be addressed soon but nothing is blocked.",
          "2": "3 - Moderate: a real problem affecting the customer's workflow, but there is a workaround or impact is limited.",
          "3": "4 - High: significant impact, a key feature is broken, or multiple users are affected; needs a fix this week.",
          "4": "5 - Critical: production down, revenue impact right now, data loss, or a security incident."
        },
        "confidence": 0.98
      }
    },
    "action": "4",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
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
          "0": "1 - No rush: a question, feature request, or minor issue that can wait for a normal release cycle.",
          "1": "2 - Low: an inconvenience or non-critical bug with a workaround; should be addressed soon but nothing is blocked.",
          "2": "3 - Moderate: a real problem affecting the customer's workflow, but there is a workaround or impact is limited.",
          "3": "4 - High: significant impact, a key feature is broken, or multiple users are affected; needs a fix this week.",
          "4": "5 - Critical: production down, revenue impact right now, data loss, or a security incident."
        },
        "confidence": 0.99
      }
    },
    "action": "1",
    "error": null
  }
]
```
