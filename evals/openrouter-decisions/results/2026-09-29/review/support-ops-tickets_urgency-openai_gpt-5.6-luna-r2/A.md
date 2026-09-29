# support-ops-tickets_urgency-openai_gpt-5.6-luna-r2

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
      "instructions": "Rate the urgency of this support ticket from 1 (no rush) to 5 (production down, revenue impact, or security incident). Use the ticket subject, body, and customer plan. Select the level that best matches the actual impact, not merely the customer's wording.",
      "criteria": [
        "No rush; informational request or issue with negligible impact.",
        "Low urgency; minor issue with a workaround and limited impact.",
        "Normal urgency; a meaningful issue affecting some users or a non-critical workflow.",
        "High urgency; significant customer or business impact, but not an active widespread outage or major security incident.",
        "Critical urgency; production is down or broadly failing, revenue is being lost, or there is a serious security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { id: input.id, subject: input.subject, body: input.body, customerPlan: input.customerPlan };",
  "decide_js": "const answer = answers && answers.urgency;\nif (!answer || answer.type !== \"score\" || typeof answer.score !== \"number\" || !Number.isFinite(answer.score)) return \"3\";\nlet rating = Math.round(answer.score) + 1;\nrating = Math.max(1, Math.min(5, rating));\nif (input && input.customerPlan === \"free\" && rating === 5) rating = 4;\nreturn String(rating);",
  "notes": "The decision model judges the ticket's urgency on an ordered five-level scale using the subject, body, impact, and customer plan. The code converts the API's zero-based score to the required 1-to-5 action by rounding to the nearest level and clamping to the valid range; malformed or missing answers fall back to 3. Free-plan tickets are capped at 4, so they can never produce action 5."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "id": "T-2210",
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
          "0": "No rush; informational request or issue with negligible impact.",
          "1": "Low urgency; minor issue with a workaround and limited impact.",
          "2": "Normal urgency; a meaningful issue affecting some users or a non-critical workflow.",
          "3": "High urgency; significant customer or business impact, but not an active widespread outage or major security incident.",
          "4": "Critical urgency; production is down or broadly failing, revenue is being lost, or there is a serious security incident."
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
      "id": "T-2211",
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
          "0": "No rush; informational request or issue with negligible impact.",
          "1": "Low urgency; minor issue with a workaround and limited impact.",
          "2": "Normal urgency; a meaningful issue affecting some users or a non-critical workflow.",
          "3": "High urgency; significant customer or business impact, but not an active widespread outage or major security incident.",
          "4": "Critical urgency; production is down or broadly failing, revenue is being lost, or there is a serious security incident."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
