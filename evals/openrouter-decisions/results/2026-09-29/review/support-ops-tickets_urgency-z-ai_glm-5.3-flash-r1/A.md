# support-ops-tickets_urgency-z-ai_glm-5.3-flash-r1

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
      "instructions": "Rate how urgently this support ticket needs attention, from 1 (no rush) to 5 (critical).",
      "criteria": [
        "1 - No rush: a general question, how-to request, or cosmetic issue; nothing is broken.",
        "2 - Low: a minor inconvenience or a non-critical feature is affected; the customer has a workaround.",
        "3 - Moderate: important functionality is degraded or intermittently failing; the customer is impacted but can still operate.",
        "4 - High: key functionality is broken; significant impact on the customer's work or business, but not a full outage.",
        "5 - Critical: production down, revenue impact, data loss, or a security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body };",
  "decide_js": "const a = answers ? answers.urgency : undefined;\nif (!a || a.type !== 'score' || typeof a.score !== 'number' || !Number.isFinite(a.score)) return '3';\nlet level = Math.round(a.score);\nif (level < 0) level = 0;\nif (level > 4) level = 4;\nlet urgency = level + 1;\nif (urgency === 5 && input && input.customerPlan === 'free') urgency = 4;\nreturn String(urgency);",
  "notes": "The model judges urgency from ticket content only: build_state_js sends just the subject and body (the same fields the old prompt used; customerPlan is deliberately left out of the state so the plan cannot bias the rating), and one score question with five ordered criteria anchors the original prompt's scale, with level 1 = no rush and level 5 = production down, revenue impact, or a security incident. decide_js treats the returned score as a zero-indexed level: it requires answers.urgency to be present with type 'score' and a finite numeric score, rounds the score to the nearest level, clamps to 0-4, and adds 1 to produce the 1-5 urgency. The free-plan rule is enforced in code, not in the prompt: a level-5 rating for a customerPlan of 'free' is capped to 4, keeping the business rule deterministic instead of hoping the model respects it. Any degenerate answer - missing key, unexpected type, or non-numeric score, including the empty-answers case if the request is ever skipped - falls back to '3', preserving the old regex-failure fallback of 3; probabilities, confidence, and legend are ignored, and exactly one Decisions request is made per ticket."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "subject": "Production API returning 500 for all requests",
      "body": "Since 09:10 UTC every call to /v1/orders returns 500. Our checkout is down and we are losing sales. Enterprise account."
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
          "0": "1 - No rush: a general question, how-to request, or cosmetic issue; nothing is broken.",
          "1": "2 - Low: a minor inconvenience or a non-critical feature is affected; the customer has a workaround.",
          "2": "3 - Moderate: important functionality is degraded or intermittently failing; the customer is impacted but can still operate.",
          "3": "4 - High: key functionality is broken; significant impact on the customer's work or business, but not a full outage.",
          "4": "5 - Critical: production down, revenue impact, data loss, or a security incident."
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
      "body": "Any plans for a dark mode in the dashboard? Not urgent, just curious."
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
          "0": "1 - No rush: a general question, how-to request, or cosmetic issue; nothing is broken.",
          "1": "2 - Low: a minor inconvenience or a non-critical feature is affected; the customer has a workaround.",
          "2": "3 - Moderate: important functionality is degraded or intermittently failing; the customer is impacted but can still operate.",
          "3": "4 - High: key functionality is broken; significant impact on the customer's work or business, but not a full outage.",
          "4": "5 - Critical: production down, revenue impact, data loss, or a security incident."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
