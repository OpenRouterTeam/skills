# support-ops-tickets_urgency-openai_gpt-5.6-luna-r3

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
      "instructions": "How urgent is this support ticket, based on the issue described in `subject` and `body`? Judge the operational impact and immediacy of the problem, not the customer's plan.",
      "criteria": [
        "No rush: informational request, minor inconvenience, cosmetic issue, or work that can wait without meaningful impact.",
        "Low urgency: limited impact or a workaround exists, with no significant business disruption.",
        "Moderate urgency: a meaningful problem affecting some users or an important workflow, but it is not broadly blocking operations.",
        "High urgency: substantial customer or business impact, a major workflow is blocked, or the issue is actively disrupting operations.",
        "Critical urgency: production is down or broadly unavailable, revenue is being materially lost, or there is an active security incident."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body };",
  "decide_js": "const answer = answers && answers.urgency;\nlet urgency = 3;\nif (answer && answer.type === \"score\" && answer.probabilities && typeof answer.probabilities === \"object\") {\n  let bestIndex = 2;\n  let bestProbability = -Infinity;\n  for (let i = 0; i < 5; i += 1) {\n    const probability = Number(answer.probabilities[String(i)]);\n    if (Number.isFinite(probability) && probability > bestProbability) {\n      bestProbability = probability;\n      bestIndex = i;\n    }\n  }\n  if (bestProbability !== -Infinity) urgency = bestIndex + 1;\n}\nif (input.customerPlan === \"free\" && urgency === 5) urgency = 4;\nreturn String(urgency);",
  "notes": "The decision model judges which of five ordered urgency levels best describes the ticket from its subject and body. Code selects the level with the highest returned score probability, defaults to 3 if a usable score distribution is absent, and applies the existing deterministic free-plan rule by capping urgency 5 at 4. The final action is always one of 1, 2, 3, 4, or 5."
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
          "0": "No rush: informational request, minor inconvenience, cosmetic issue, or work that can wait without meaningful impact.",
          "1": "Low urgency: limited impact or a workaround exists, with no significant business disruption.",
          "2": "Moderate urgency: a meaningful problem affecting some users or an important workflow, but it is not broadly blocking operations.",
          "3": "High urgency: substantial customer or business impact, a major workflow is blocked, or the issue is actively disrupting operations.",
          "4": "Critical urgency: production is down or broadly unavailable, revenue is being materially lost, or there is an active security incident."
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
          "0": "No rush: informational request, minor inconvenience, cosmetic issue, or work that can wait without meaningful impact.",
          "1": "Low urgency: limited impact or a workaround exists, with no significant business disruption.",
          "2": "Moderate urgency: a meaningful problem affecting some users or an important workflow, but it is not broadly blocking operations.",
          "3": "High urgency: substantial customer or business impact, a major workflow is blocked, or the issue is actively disrupting operations.",
          "4": "Critical urgency: production is down or broadly unavailable, revenue is being materially lost, or there is an active security incident."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
