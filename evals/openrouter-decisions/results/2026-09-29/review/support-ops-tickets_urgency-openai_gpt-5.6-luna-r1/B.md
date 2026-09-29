# support-ops-tickets_urgency-openai_gpt-5.6-luna-r1

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
      "instructions": "How urgent is this support ticket? Judge the impact and time sensitivity of the issue described in `ticket.subject` and `ticket.body`. Use the highest level clearly supported by the ticket; do not infer urgency from the customer's plan.",
      "criteria": [
        "Urgency 1: No meaningful operational impact or time pressure; general questions, minor inconveniences, or issues that can wait.",
        "Urgency 2: Low-impact issue affecting a limited workflow or user, with a reasonable workaround and no immediate business risk.",
        "Urgency 3: Material issue affecting normal work or multiple users, but not a widespread outage, immediate revenue loss, or serious security incident.",
        "Urgency 4: High-impact issue affecting an important workflow, many users, or significant business operations, but not clearly a complete production outage or immediate major revenue loss.",
        "Urgency 5: Production is down or broadly unavailable, the ticket describes immediate or substantial revenue impact, or it reports an active or severe security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { ticket: { subject: input.subject, body: input.body } };",
  "decide_js": "const answer = answers && answers.urgency;\nlet urgency = 3;\nif (answer && answer.type === \"score\" && answer.probabilities && typeof answer.probabilities === \"object\") {\n  let bestIndex = -1;\n  let bestProbability = -Infinity;\n  for (let i = 0; i < 5; i++) {\n    const probability = Number(answer.probabilities[String(i)]);\n    if (Number.isFinite(probability) && probability > bestProbability) {\n      bestProbability = probability;\n      bestIndex = i;\n    }\n  }\n  if (bestIndex >= 0) urgency = bestIndex + 1;\n}\nif (input.customerPlan === \"free\" && urgency === 5) urgency = 4;\nreturn String(urgency);",
  "notes": "The decision model judges the ticket's urgency across five ordered levels using the subject and body. JavaScript selects the level with the highest returned probability, falls back to 3 if the answer is missing or malformed, and enforces the existing deterministic rule that free-plan tickets can never receive urgency 5 by downgrading such results to 4."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "subject": "Production API returning 500 for all requests",
        "body": "Since 09:10 UTC every call to /v1/orders returns 500. Our checkout is down and we are losing sales. Enterprise account."
      }
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
          "0": "Urgency 1: No meaningful operational impact or time pressure; general questions, minor inconveniences, or issues that can wait.",
          "1": "Urgency 2: Low-impact issue affecting a limited workflow or user, with a reasonable workaround and no immediate business risk.",
          "2": "Urgency 3: Material issue affecting normal work or multiple users, but not a widespread outage, immediate revenue loss, or serious security incident.",
          "3": "Urgency 4: High-impact issue affecting an important workflow, many users, or significant business operations, but not clearly a complete production outage or immediate major revenue loss.",
          "4": "Urgency 5: Production is down or broadly unavailable, the ticket describes immediate or substantial revenue impact, or it reports an active or severe security incident."
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
      "ticket": {
        "subject": "Dark mode?",
        "body": "Any plans for a dark mode in the dashboard? Not urgent, just curious."
      }
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
          "0": "Urgency 1: No meaningful operational impact or time pressure; general questions, minor inconveniences, or issues that can wait.",
          "1": "Urgency 2: Low-impact issue affecting a limited workflow or user, with a reasonable workaround and no immediate business risk.",
          "2": "Urgency 3: Material issue affecting normal work or multiple users, but not a widespread outage, immediate revenue loss, or serious security incident.",
          "3": "Urgency 4: High-impact issue affecting an important workflow, many users, or significant business operations, but not clearly a complete production outage or immediate major revenue loss.",
          "4": "Urgency 5: Production is down or broadly unavailable, the ticket describes immediate or substantial revenue impact, or it reports an active or severe security incident."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
