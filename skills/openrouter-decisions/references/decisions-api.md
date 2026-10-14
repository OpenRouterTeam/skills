# Decisions API reference

`POST https://openrouter.ai/api/alpha/decisions` with `Authorization: Bearer $OPENROUTER_API_KEY`. The source of truth is the [OpenAPI page](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request), which also lists error responses. This page condenses it to the shapes and rules an integration needs. Any decision model ID from the live catalog goes in `model` (the examples use `typesafe/jev-1.13`); how to list and choose between them is in [models.md](models.md).

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
- Images go in `state` as an array item `{ "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }`, next to plain-string text items (not `{ "type": "text" }` parts). Only base64 data URLs of `image/png`, `image/jpeg`, or `image/webp` are read; remote `http(s)` URLs are not fetched, images nested inside objects are not read as images, and a top-level `images` field is rejected with a 400. Only models that list image input accept them, so pick one whose `architecture.input_modalities` contains `image` (the `input` column of `scripts/models.ts`), and see the [multimodal decisions guide](https://openrouter.ai/docs/guides/community/multimodal-decisions) for per-model image counts and size limits.
- Audio and video are read only by models whose `architecture.input_modalities` lists them (currently `cloudflare/clef-omni`), as `state` array items in the Chat Completions part shapes: `{ "type": "input_audio", "input_audio": { "data": "<raw base64>", "format": "wav" } }` (no `data:` prefix; `format` one of `wav`, `mp3`, `mpeg`, `m4a`, `mp4`, `aac`, `aiff`, `aif`, `flac`, `ogg`, `opus`, `webm`) and `{ "type": "video_url", "video_url": { "url": "data:video/mp4;base64,..." } }` (base64 `data:video/...` URLs only, remote URLs are not fetched). Clef and Clef Flash reject requests containing them, and other decision models see them as plain JSON text. Per-request clip counts and size/duration caps are in the same guide.
- `questions` is an object keyed by your own IDs.
- `choice.criteria` maps option name to description. `noul.criteria` is optional and has exactly `true` and `false`. `score.criteria` is an ordered array, lowest level first, and the answer's `legend` maps `"0"`, `"1"`, ... back to it.
- `instructions` and every criterion accept a string or a JSON structure.
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

Every answer carries `type`. Check it before reading fields, and treat a missing key or an unexpected `type` as an error rather than a default. `noul`, `choice`, and `score` are always present. The schema marks `probabilities`, `confidence`, and `legend` optional, so read them through a presence check even though current models return them. `legend` values keep the structure of the `criteria` you sent. `model` is the exact build that answered and `usage.cost` is in USD.

## curl

```bash
curl -s https://openrouter.ai/api/alpha/decisions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json
```

## OpenRouter TypeScript SDK

The Decisions path lives outside the `/api/v1` prefix the SDK uses by default, so construct the client with `serverURL: 'https://openrouter.ai'`. [scripts/lib.ts](../scripts/lib.ts) wraps both transports with request validation and typed answers (`parseRequest`, `decide`).

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
