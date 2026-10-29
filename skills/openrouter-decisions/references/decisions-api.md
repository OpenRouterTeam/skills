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
- `questions` is an object keyed by your own IDs.
- `choice.criteria` maps option name to description. `noul.criteria` is optional and has exactly `true` and `false`. `score.criteria` is an ordered array, lowest level first, and the answer's `legend` maps `"0"`, `"1"`, ... back to it.
- `instructions` and every criterion accept a string or a JSON structure.
- `box` (Jev 1.14 only) takes `instructions` naming the target and the image it is in, and no `criteria`.
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

A `box` answer is `{ "type": "box", "box": { "top": 0.1, "bottom": 0.44, "left": 0.69, "right": 0.96 }, "confidence": 0.95 }`, each edge a fraction of the image measured from the top-left corner.

Every answer carries `type`. Check it before reading fields, and treat a missing key or an unexpected `type` as an error rather than a default. `noul`, `choice`, `score`, and `box` are always present. The schema marks `probabilities`, `confidence`, and `legend` optional, so read them through a presence check even though current models return them. `legend` values keep the structure of the `criteria` you sent. `model` is the exact build that answered and `usage.cost` is in USD.

## Images and Box

Put each image in the top-level `state` array as an inline data URL, next to plain-string text items:

```json
{
  "model": "typesafe/jev-1.14",
  "state": [
    "`photo` is the image below.",
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ],
  "questions": {
    "has_mug": { "type": "noul", "instructions": "Is there a coffee mug in `photo`?" },
    "mug": { "type": "box", "instructions": "Where is the coffee mug in `photo`?" }
  }
}
```

- List the models that read images with `GET /api/v1/models?output_modalities=decisions&input_modalities=image`. Jev also reads image parts nested inside `state` objects, an array-valued `instructions`, and criteria; other models read images only in the top-level `state` array.
- Remote `http(s)` URLs are not fetched. Jev accepts PNG and JPEG, 256 to 1,568 pixels per side, with EXIF orientation not applied. Clef and Clef Flash estimate tokens from the base64 length (about 4 characters per token) and return a `413` past 65,536, so keep images for them under about 300 KB before encoding.
- OpenRouter also accepts TypeSafe's top-level `assets` map: each asset is `{ "type": "image", "format": "png" | "jpg" | "jpeg", "data_base64": "..." }` (no `data:` prefix), and its key is written as a reference in `state`, `instructions`, or `criteria`. Every asset must be referenced, or the request fails with a `400`. Jev reads a reference as a whole string or inside longer text; other image-capable models read only a whole-string reference that is a top-level `state` item. Pick references that cannot occur by accident, such as a UUID per image. `image_url` parts and `assets` can be mixed. The bundled scripts reject `assets`, so use inline image parts with them or send asset requests through your own client. A top-level `images` field is rejected with a `400`. No `TypeSafe-Danger-Zone-Images` header is needed.
- `box` always returns four edges, even when the target is absent or `state` has no image, so pair it with a `noul` that asks whether the target is there. Jev 1.13 rejects `box` with a `400`.
- Images and Box are early features whose format and limits can change. Check [multimodal decisions](https://openrouter.ai/docs/guides/community/multimodal-decisions.md) before relying on a detail.

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

## System One API and the TypeSafe SDK

`POST https://openrouter.ai/api/v1/systemone` ([reference](https://openrouter.ai/docs/api/api-reference/systemone/submit-a-system-one-request)) takes the same body and returns the same answers as the Decisions API, for code already on TypeSafe's SDK or API. `model` is still required. A bare TypeSafe ID maps onto the `typesafe/` namespace (`jev-1.14` becomes `typesafe/jev-1.14`, `jev-latest` becomes the alias `~typesafe/jev-latest`), and an ID with a vendor prefix is used as-is, so any decision model in the catalog answers there.

An existing `@typesafe-ai/sdk` or `typesafe_sdk` client works unchanged with `baseURL: 'https://openrouter.ai/api'` (`base_url` in Python) and an OpenRouter key as `apiKey`, or with `TYPESAFE_BASE_URL=https://openrouter.ai/api` and `TYPESAFE_API_KEY=<OpenRouter key>` ([guide](https://openrouter.ai/docs/guides/community/typesafe-sdk)). Its `client.models.list()` does not work against OpenRouter, so read the catalog as in [models.md](models.md). TypeSafe's own docs and cookbooks target TypeSafe's API: translate them to OpenRouter's base URL and key and a `model` on every request; their `assets` image references work unchanged.

```typescript
import { TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api' });
const response = await client.systemOne({
  model: 'jev-1.14',
  state: { ticket: 'I was charged twice for my subscription.' },
  questions: { refund: { type: 'noul', instructions: 'Is the customer asking for money back?' } },
});
```

Python and Go clients expose the same operation as `alpha.decisions.create` with a `decisions_request` body. Reference pages: [TypeScript](https://openrouter.ai/docs/client-sdks/typescript/sdks/decisions/README), [Python](https://openrouter.ai/docs/client-sdks/python/sdks/decisions/README), [Go](https://openrouter.ai/docs/client-sdks/go/sdks/decisions/README).
