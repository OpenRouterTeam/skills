---
name: openrouter-video
description: Generate videos from text prompts (and optional reference or frame images) using OpenRouter's asynchronous video generation API. Use when the user asks to create, generate, or make a video or animation from a description, animate an existing image, or turn a prompt into a short video clip.
---

# OpenRouter Video

Generate videos via OpenRouter's async `POST /api/v1/videos` using `curl` + `jq`. Requires `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys). If unset, stop and ask.

## The three steps

Video generation is async: submit → poll → download. A single request can't return the video because generation takes 30s–a few minutes. Tell the user the job was submitted so they know the delay is expected.

1. `POST /api/v1/videos` → `{ id, polling_url, status: "pending" }`
2. `GET <polling_url>` every ~30s until `status` is `completed` (terminal failures: `failed`, `cancelled`, `expired` — surface the `error` field verbatim)
3. `GET /api/v1/videos/{id}/content?index=0` **with the auth header** → MP4 bytes

## Pick parameters from the models endpoint, don't guess

`resolution`, `aspect_ratio`, `duration`, and `frame_images[].frame_type` are per-model. Before the first submit for a new model (or whenever the user asks for something specific), fetch the model's capabilities and only send values from the returned sets:

```bash
curl -sS https://openrouter.ai/api/v1/videos/models \
  | jq '.data[] | select(.id == "MODEL_ID")'
```

Fields on each model worth knowing: `input_modalities` (which reference modalities the model accepts — e.g. `image`, `audio`, `video`), `supported_resolutions`, `supported_aspect_ratios`, `supported_sizes`, `supported_durations` (often discrete like `[4,6,8]`, not a range), `supported_frame_images` (which `frame_type` values are accepted), `generate_audio` and `seed` (capability bools), `pricing_skus`, and `allowed_passthrough_parameters`. An out-of-set value returns a 400, so validate client-side.

## Full workflow (drop-in)

```bash
#!/usr/bin/env bash
set -euo pipefail

PROMPT="a golden retriever playing fetch on a sunny beach"
MODEL="google/veo-3.1"
OUTPUT="video-$(date +%Y%m%d-%H%M%S).mp4"

# Build payload — extend with resolution/aspect_ratio/duration/etc. as needed.
payload=$(jq -n --arg model "$MODEL" --arg prompt "$PROMPT" \
  '{model: $model, prompt: $prompt}')

submit=$(curl -sS -X POST https://openrouter.ai/api/v1/videos \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$payload")

poll_url=$(echo "$submit" | jq -r '.polling_url')
echo "Submitted $(echo "$submit" | jq -r '.id')" >&2

while :; do
  sleep 30
  resp=$(curl -sS "$poll_url" -H "Authorization: Bearer $OPENROUTER_API_KEY")
  # Avoid the name `status` — zsh treats it as read-only.
  st=$(echo "$resp" | jq -r '.status')
  echo "Status: $st" >&2
  case "$st" in
    completed) break ;;
    failed|cancelled|expired)
      echo "Generation $st: $(echo "$resp" | jq -r '.error // "unknown"')" >&2
      exit 1 ;;
  esac
done

curl -sS -L "$(echo "$resp" | jq -r '.unsigned_urls[0]')" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  --output "$OUTPUT"

echo "$resp" | jq --arg out "$(realpath "$OUTPUT")" \
  '{job_id: .id, generation_id, video_saved: $out, usage}'
```

## Parameters

Required: `model`, `prompt`. Common optional fields:

- `duration` (int) — must be one of the model's `supported_durations`.
- `resolution` (string) / `aspect_ratio` (string) / `size` (string, `"WxH"`) — `size` is interchangeable with resolution + aspect_ratio.
- `generate_audio` (bool) — only meaningful if the model's `generate_audio` capability is true.
- `seed` (int) — honored only if the model's `seed` capability is true.
- `callback_url` (HTTPS) — webhook instead of polling.
- `frame_images[]` — image-to-video; each entry is `{ type: "image_url", image_url: { url }, frame_type: "first_frame" | "last_frame" }`.
- `input_references[]` — reference-to-video (style guidance); each entry is `{ type: "image_url" | "audio_url" | "video_url", ... }`. If both arrays are present, `frame_images` wins.
- `provider.options.<slug>.parameters.<key>` — provider passthrough, see below.

Reference modalities are gated by the model's `input_modalities`: sending an `input_references` entry (or `frame_images`, always `image`) whose modality the model doesn't accept returns a 400 (e.g. `model "X" does not accept audio input references`). Check `input_modalities` before submitting.

Image `url` can be a public `https://` URL or a local-file data URL: `MIME=image/png; B64=$(base64 < file.png | tr -d '\n'); url="data:${MIME};base64,${B64}"`.

## Provider passthrough

Provider-specific params go under `provider.options.<slug>.parameters`. The allowed keys for a given model are listed (flat) in `allowed_passthrough_parameters` on the models endpoint — but the meaning, value range, and required combinations come from the *upstream provider's* API docs (Google Vertex, Alibaba Dashscope, Kwai, ByteDance Volc Engine, MiniMax, OpenAI, etc.). Read the upstream docs before using an unfamiliar key; casing conventions differ between providers (Google/OpenAI use camelCase, most others use snake_case).

Example:

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

## Webhooks (optional)

Pass `callback_url` (HTTPS) in the submit body. On terminal state, OpenRouter POSTs a `video.generation.{completed,failed,cancelled,expired}` event. Each delivery carries `X-OpenRouter-Idempotency-Key: <job_id>-<status>`. If a signing secret is configured on the workspace, verify `X-OpenRouter-Signature: t=<ts>,v1=<hmac>` — HMAC-SHA256 of `<ts>,<raw_body>` with the secret, reject timestamps older than ~5 minutes.

## References

- [Video generation guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [Models page (filter by video output)](https://openrouter.ai/models?output_modalities=video)

Video generation is not ZDR-eligible because the provider must temporarily retain the output for the async download step.
