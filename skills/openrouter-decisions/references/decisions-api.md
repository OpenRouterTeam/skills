# Decisions API reference

`POST https://openrouter.ai/api/alpha/decisions` with `Authorization: Bearer $OPENROUTER_API_KEY`. Every decision model on OpenRouter takes the same request and returns the same response shape. Model IDs, per-model limits, and vendor-specific surfaces are in [models.md](models.md). The examples below use `typesafe/jev-1.13`, and any decision model ID goes in `model`.

## Request

```json
{
  "model": "typesafe/jev-1.13",
  "state": {
    "customer_tier": "enterprise",
    "ticket": "My checkout page shows a blank screen after I click Pay. I have tried two browsers."
  },
  "questions": {
    "is_bug": {
      "type": "noul",
      "instructions": "Is the customer reporting a software defect?",
      "criteria": {
        "true": "The customer describes broken or unexpected product behavior.",
        "false": "The customer is asking a question or requesting a feature."
      }
    },
    "team": {
      "type": "choice",
      "instructions": "Which team should own this ticket?",
      "criteria": {
        "payments": "Checkout, billing, or payment processing issues.",
        "frontend": "Rendering, layout, or browser compatibility issues.",
        "account": "Login, permissions, or profile issues.",
        "none": "None of the teams above."
      }
    },
    "urgency": {
      "type": "score",
      "instructions": "How urgent is this ticket?",
      "criteria": [
        "Can wait for the next release",
        "Should be fixed this week",
        "Blocking revenue right now"
      ]
    }
  }
}
```

- `state` is a string, object, or array. Objects with named fields are preferred.
- `questions` is an object keyed by your own IDs. Keys are not sent to the model.
- `choice.criteria` is an object mapping option name to description.
- `noul.criteria` is optional and has exactly `true` and `false` keys.
- `score.criteria` is an ordered array of level descriptions, lowest first. The answer's `legend` maps `"0"`, `"1"`, ... back to them.
- `instructions` and every criterion accept a string or JSON structure.
- Optional: `session_id` and `trace` for observability grouping, `user` for per-end-user attribution, `provider` for routing preferences. The bundled scripts forward `session_id` and `user` and reject the other two, so send `trace` and `provider` from your own client.

## Response

```json
{
  "id": "gen-dec-1790265859-EaXKST7hul1Wcqots1ZK",
  "model": "typesafe/jev-1.13-20260917",
  "provider": "TypeSafe",
  "answers": {
    "is_bug": { "type": "noul", "noul": 0.96 },
    "team": {
      "type": "choice",
      "choice": "payments",
      "probabilities": { "payments": 0.78, "frontend": 0.22, "account": 0, "none": 0 },
      "confidence": 0.67
    },
    "urgency": {
      "type": "score",
      "score": 1.99,
      "legend": { "0": "Can wait for the next release", "1": "Should be fixed this week", "2": "Blocking revenue right now" },
      "probabilities": { "0": 0, "1": 0, "2": 1 },
      "confidence": 0.99
    }
  },
  "usage": { "input_tokens": 476, "output_tokens": 70, "cost": 0.000019992 }
}
```

Every answer carries `type`. Check it before reading fields, and treat a missing key or an unexpected `type` as an error rather than a default. The `model` field carries the exact build that answered. Log it with every stored answer. `usage.cost` is in USD.

## curl

```bash
curl -s https://openrouter.ai/api/alpha/decisions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json
```

## OpenRouter TypeScript SDK

The Decisions path lives outside the `/api/v1` prefix the SDK uses by default, so construct the client with `serverURL: 'https://openrouter.ai'`.

```typescript
import { OpenRouter } from '@openrouter/sdk';

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY, serverURL: 'https://openrouter.ai' });

const response = await client.alpha.decisions.create({
  decisionsRequest: {
    model: 'typesafe/jev-1.13',
    state: { ticket: 'I was charged twice for my subscription.' },
    questions: {
      refund: { type: 'noul', instructions: 'Is the customer asking for money back?' },
    },
  },
});

const refund = response.answers.refund;
if (refund.type !== 'noul') throw new Error('expected a noul answer');
console.log(refund.noul);
```

Python and Go clients expose the same operation as `alpha.decisions.create` with a `decisions_request` body. Reference pages: [TypeScript](https://openrouter.ai/docs/client-sdks/typescript/sdks/decisions/README), [Python](https://openrouter.ai/docs/client-sdks/python/sdks/decisions/README), [Go](https://openrouter.ai/docs/client-sdks/go/sdks/decisions/README).
