# support-ops-tickets_urgency-openai_gpt-5.6-luna-r1

Site: `src/tickets/urgency.ts`

Brief given to both authors:

> Replace the chat-completion call and regex parsing in rateUrgency() with a decision model, keeping the same 1 to 5 urgency output and the existing rule that free-plan tickets never rate 5.

## Candidate A

### Design

```json
{
  "questions": {
    "urgency": {
      "type": "score",
      "instructions": "Rate the urgency of this support ticket from 1 (no rush) to 5 (production down, revenue impact, or security incident). Consider the customer plan when assessing context, but the application separately enforces that free-plan tickets cannot receive a final rating of 5.",
      "criteria": [
        "No rush; informational request or negligible impact.",
        "Low urgency; minor issue with a reasonable workaround.",
        "Moderate urgency; meaningful issue affecting some users or workflow, but not critical.",
        "High urgency; substantial customer impact or time-sensitive business consequences.",
        "Critical urgency; production is down, revenue is being lost, or there is a security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body, customerPlan: input.customerPlan };",
  "decide_js": "var answer = answers && answers.urgency;\nvar rating = 3;\nif (answer && answer.type === \"score\" && typeof answer.score === \"number\" && Number.isFinite(answer.score)) {\n  rating = Math.round(answer.score) + 1;\n}\nrating = Math.max(1, Math.min(5, rating));\nif (input.customerPlan === \"free\" && rating === 5) rating = 4;\nreturn String(rating);",
  "notes": "The decision model judges the ticket against five urgency levels from no rush through production outage, revenue impact, or security incident. JavaScript converts the score's zero-based value to a 1-to-5 rating, clamps malformed or out-of-range results to the valid range with a fallback of 3, and caps free-plan tickets at 4."
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
          "0": "No rush; informational request or negligible impact.",
          "1": "Low urgency; minor issue with a reasonable workaround.",
          "2": "Moderate urgency; meaningful issue affecting some users or workflow, but not critical.",
          "3": "High urgency; substantial customer impact or time-sensitive business consequences.",
          "4": "Critical urgency; production is down, revenue is being lost, or there is a security incident."
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
          "0": "No rush; informational request or negligible impact.",
          "1": "Low urgency; minor issue with a reasonable workaround.",
          "2": "Moderate urgency; meaningful issue affecting some users or workflow, but not critical.",
          "3": "High urgency; substantial customer impact or time-sensitive business consequences.",
          "4": "Critical urgency; production is down, revenue is being lost, or there is a security incident."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
