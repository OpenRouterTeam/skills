# Decisions API reference

Two surfaces reach Jev through OpenRouter. Both take an OpenRouter API key and bill the same account.

| Surface | Endpoint | Use when |
| --- | --- | --- |
| Decisions API | `POST https://openrouter.ai/api/alpha/decisions` | Plain HTTP from any language, or the OpenRouter TypeScript, Python, or Go SDK |
| System One API | `POST https://openrouter.ai/api/v1/systemone` | You already use the TypeSafe JavaScript or Python SDK and want to point it at OpenRouter |

## Model IDs

| ID | Meaning |
| --- | --- |
| `typesafe/jev-1.13` | Pinned release. Use for production and anything with tuned thresholds. |
| `~typesafe/jev-latest` | Alias that follows the newest Jev release. Probabilities can shift when it moves. |

The response `model` field carries the exact build that answered, for example `typesafe/jev-1.13-20260917`. Log it with every stored answer. Context length is 32,000 tokens. Billing is per input token, output tokens are free, and `usage.cost` is in USD.

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

Every answer carries `type`. Check it before reading fields, and treat a missing key or an unexpected `type` as an error rather than a default.

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

## TypeSafe SDK pointed at OpenRouter

The official TypeSafe SDK appends `/v1/systemone` to its base URL and takes the bare model ID.

```typescript
import { TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api' });
const result = await client.systemOne({ model: 'jev-1.13', state, questions });
```

```python
from typesafe_sdk import TypeSafeClient

client = TypeSafeClient(api_key=os.environ["OPENROUTER_API_KEY"], base_url="https://openrouter.ai/api")
result = client.system_one(model="jev-1.13", state=state, questions=questions)
```

TypeSafe's own docs cover the SDK surface: https://docs.typesafe.ai/llms.txt
