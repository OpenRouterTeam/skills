---
name: openrouter-video
description: Generate videos from text prompts (and optional reference or frame images) using OpenRouter's asynchronous video generation API. Use when the user asks to create, generate, or make a video or animation from a description, animate an existing image, or turn a prompt into a short video clip.
---

# OpenRouter Video

Generate videos via OpenRouter's async `/api/v1/videos` endpoint using `curl` and `jq`.

## Prerequisites

- `OPENROUTER_API_KEY` environment variable. Get a key at https://openrouter.ai/keys.
- `curl` and `jq` (standard on macOS and most Linux distros).

Do not proceed without `OPENROUTER_API_KEY`. If it's unset, stop and ask the user for it.

## How the API Works

Video generation is **asynchronous** — a single request can't return the video because generation takes 30 seconds to several minutes. The flow is always three steps:

1. **Submit** — `POST /api/v1/videos` → returns `{ id, polling_url, status: "pending" }`
2. **Poll** — `GET /api/v1/videos/{id}` every ~30s until `status` is `completed` (or a terminal failure: `failed`, `cancelled`, `expired`)
3. **Download** — `GET /api/v1/videos/{id}/content?index=0` with auth → writes the MP4 to disk

Use the end-to-end script in [Full Workflow](#full-workflow) for the happy path. The individual sections below exist if the user only wants one step (e.g. "just submit the job", "check job abc123").

## Full Workflow

Drop-in bash script. Edit the `PROMPT`, `MODEL`, and optional params at the top; everything else is mechanical.

```bash
#!/usr/bin/env bash
set -euo pipefail

PROMPT="a golden retriever playing fetch on a sunny beach"
MODEL="google/veo-3.1"
OUTPUT="video-$(date +%Y%m%d-%H%M%S).mp4"
POLL_INTERVAL=30

# Optional: uncomment and edit as needed. Pass through --arg into jq below.
#   RESOLUTION="1080p"
#   ASPECT_RATIO="16:9"
#   DURATION=5

payload=$(jq -n --arg model "$MODEL" --arg prompt "$PROMPT" \
  '{model: $model, prompt: $prompt}')
# For extra fields, pipe through more jq, e.g.:
#   payload=$(echo "$payload" | jq --arg r "$RESOLUTION" '. + {resolution: $r}')
#   payload=$(echo "$payload" | jq --argjson d "$DURATION" '. + {duration: $d}')

submit=$(curl -sS -X POST "https://openrouter.ai/api/v1/videos" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$payload")

job_id=$(echo "$submit" | jq -r '.id')
polling_url=$(echo "$submit" | jq -r '.polling_url')
echo "Submitted job $job_id" >&2

while :; do
  sleep "$POLL_INTERVAL"
  status_json=$(curl -sS "$polling_url" -H "Authorization: Bearer $OPENROUTER_API_KEY")
  status=$(echo "$status_json" | jq -r '.status')
  echo "Status: $status" >&2
  case "$status" in
    completed) break ;;
    failed|cancelled|expired)
      echo "Generation $status: $(echo "$status_json" | jq -r '.error // "unknown error"')" >&2
      exit 1 ;;
  esac
done

content_url=$(echo "$status_json" | jq -r '.unsigned_urls[0]')
curl -sS -L "$content_url" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  --output "$OUTPUT"

echo "$status_json" | jq --arg out "$(realpath "$OUTPUT")" \
  '{job_id: .id, generation_id, video_saved: $out, usage}'
```

Tell the user up front that submission returns immediately but the poll loop will block for 30 seconds to a few minutes depending on the model and resolution.

## Step 1: Submit a Job

### Text-to-Video

```bash
curl -sS -X POST "https://openrouter.ai/api/v1/videos" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/veo-3.1",
    "prompt": "a golden retriever playing fetch on a sunny beach"
  }'
```

Response:

```json
{
  "id": "abc123",
  "polling_url": "https://openrouter.ai/api/v1/videos/abc123",
  "status": "pending"
}
```

### Image-to-Video (first/last frame)

For a local file, base64-encode it into a `data:` URL. For a public HTTPS URL, use it directly:

```bash
# Local file → data URL
MIME="image/png"   # or image/jpeg, image/webp, image/gif
B64=$(base64 < ./hero.png | tr -d '\n')
FRAME_URL="data:${MIME};base64,${B64}"

curl -sS -X POST "https://openrouter.ai/api/v1/videos" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg url "$FRAME_URL" '{
    model: "alibaba/wan-2.7",
    prompt: "a character walking through a forest",
    frame_images: [
      { type: "image_url", image_url: { url: $url }, frame_type: "first_frame" }
    ],
    resolution: "1080p"
  }')"
```

Both first and last frame can be supplied together to bracket a transition. If both `frame_images` and `input_references` are provided, `frame_images` wins.

### Reference-to-Video (style references)

```bash
curl -sS -X POST "https://openrouter.ai/api/v1/videos" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "alibaba/wan-2.7",
    "prompt": "a colossal solar flare beside a planet",
    "input_references": [
      { "type": "image_url", "image_url": { "url": "https://example.com/style-ref.png" } }
    ],
    "resolution": "1080p"
  }'
```

### Request Parameters

| Parameter | Type | Description |
|---|---|---|
| `model` | string | Required. Video model ID (e.g. `google/veo-3.1`). |
| `prompt` | string | Required. Text description. |
| `duration` | int | Video length in seconds. |
| `resolution` | string | `480p`, `720p`, `1080p`, `1K`, `2K`, `4K`. |
| `aspect_ratio` | string | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9`, `9:21`. |
| `size` | string | Exact pixel dimensions like `1280x720`. Interchangeable with `resolution` + `aspect_ratio`. |
| `frame_images` | array | First/last frame images for **image-to-video**. Each entry needs `frame_type: "first_frame" \| "last_frame"`. |
| `input_references` | array | Style reference images for **reference-to-video**. Ignored if `frame_images` is also set. |
| `generate_audio` | bool | Defaults to `true` on audio-capable models. Set `false` to skip audio. |
| `seed` | int | Seed for deterministic generation (not guaranteed by every provider). |
| `callback_url` | string | HTTPS webhook URL for a completion notification instead of polling. |
| `provider` | object | Provider-specific passthrough (see [Provider Options](#provider-options)). |

Check what a specific model actually supports via the [models endpoint](#discovering-video-models) — some models only allow certain resolutions or aspect ratios and will reject others.

## Step 2: Poll for Status

```bash
curl -sS "https://openrouter.ai/api/v1/videos/$JOB_ID" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Completed response:

```json
{
  "id": "abc123",
  "generation_id": "gen-xyz789",
  "status": "completed",
  "unsigned_urls": ["https://openrouter.ai/api/v1/videos/abc123/content?index=0"],
  "usage": { "cost": 0.5, "is_byok": false }
}
```

### Job Statuses

| Status | Meaning |
|---|---|
| `pending` | Queued, not yet running. |
| `in_progress` | Generating. |
| `completed` | Ready to download. |
| `failed` | Generation failed — see `error` field. Terminal. |
| `cancelled` | Cancelled. Terminal. |
| `expired` | Exceeded max TTL. Terminal. |

Poll every 30s. Polling more frequently wastes API calls — generation times are measured in tens of seconds to minutes.

## Step 3: Download the Video

Use either the URL from `unsigned_urls[0]` or hit the content endpoint directly. **Auth is required.**

```bash
curl -sS -L "https://openrouter.ai/api/v1/videos/$JOB_ID/content?index=0" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  --output video.mp4
```

The `index` query parameter defaults to `0`. If the model returned multiple outputs, iterate over each entry in `unsigned_urls[]`.

## Discovering Video Models

Use the dedicated endpoint (no auth required) to see every video model and its supported parameters:

```bash
curl -sS "https://openrouter.ai/api/v1/videos/models" | jq '.data[] | {
  id,
  name,
  resolutions: .supported_resolutions,
  aspect_ratios: .supported_aspect_ratios,
  sizes: .supported_sizes,
  pricing: .pricing_skus,
  passthrough: .allowed_passthrough_parameters
}'
```

Run this first if the user asks for an unusual resolution/aspect ratio, or if a generation fails with a parameter-related error.

## Provider Options

Pass provider-specific fields via the `provider.options` object, keyed by provider slug. Only options for the matched provider are forwarded:

```json
{
  "model": "google/veo-3.1",
  "prompt": "a time-lapse of a flower blooming",
  "provider": {
    "options": {
      "google-vertex": {
        "parameters": {
          "personGeneration": "allow",
          "negativePrompt": "blurry, low quality"
        }
      }
    }
  }
}
```

The model's `allowed_passthrough_parameters` field (from the models endpoint) lists which keys a given model accepts.

## Webhooks (optional, instead of polling)

Pass `callback_url` (must be HTTPS) in the submit payload. On terminal state, OpenRouter POSTs to that URL with one of:

- `video.generation.completed` — includes `unsigned_urls`, `usage`
- `video.generation.failed` — includes `error`
- `video.generation.cancelled`
- `video.generation.expired`

Each delivery carries `X-OpenRouter-Idempotency-Key: <job_id>-<status>`. If a workspace signing secret is configured, verify `X-OpenRouter-Signature: t=<ts>,v1=<hmac>` using HMAC-SHA256 of `<ts>,<raw_body>` with the raw (un-reparsed) request body. Reject signatures older than ~5 minutes to prevent replay.

## Presenting Results

- Video generation takes 30 seconds to several minutes. Tell the user when you submit so they know why there's a delay.
- After download, surface the absolute path and `usage.cost` (USD) if present.
- If a job enters `failed`, `cancelled`, or `expired`, pass the `error` field back verbatim — it usually explains the cause (content policy, invalid parameter, etc.).
- If a parameter-related failure happens, suggest running the models endpoint to confirm what the chosen model actually supports, then retry.

## Zero Data Retention

Video generation is **not eligible** for ZDR because the provider must temporarily retain the output for the async download step. If ZDR is enforced on the account or per-request, video generation requests will not be routed.

## References

- [Video generation guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [Models page (filter by video output)](https://openrouter.ai/models?output_modalities=video)
