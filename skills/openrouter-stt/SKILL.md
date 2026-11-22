---
name: openrouter-stt
description: Transcribe speech to text using OpenRouter's speech-to-text API. Use when the user asks to transcribe audio, convert speech to text, extract a transcript from a recording or meeting, caption a video's audio, or mentions STT, speech-to-text, ASR, or transcription.
---

# OpenRouter Speech-to-Text

Transcribe audio via `POST /api/v1/audio/transcriptions` using `curl`. Requires `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys). If unset, stop and ask.

This skill sends JSON with base64 audio under `input_audio: { data, format }`. The endpoint also accepts OpenAI-style `multipart/form-data` (a `file` field, 25 MB cap), so the official OpenAI SDKs work with `base_url="https://openrouter.ai/api/v1"`. In multipart, repeat `keyterms[]` once per term, send `trace` as one JSON-encoded text part, and on providers that support it send `source_url` (a public http(s) URL the provider downloads) instead of `file` — exactly one of the two. Prefer base64 JSON for files past 25 MB on OpenAI and Groq models; other providers reject base64 JSON past the multipart cap.

## One call, JSON back

Both request and response are JSON. The response body carries:

- `text` — the transcript.
- `usage` — always includes `cost`. Providers additionally report either `seconds` of audio billed or a token breakdown (`total_tokens`, `input_tokens`, `output_tokens`), depending on how they price the request. Don't assume both are present.

Sample response (duration-priced provider, e.g. `google/chirp-3`):

```json
{
  "text": "I used to rule the world.",
  "usage": {
    "seconds": 20,
    "cost": 0.005333
  }
}
```

Sample response (token-priced provider):

```json
{
  "text": "Hello, this is a test of speech-to-text transcription.",
  "usage": {
    "total_tokens": 113,
    "input_tokens": 83,
    "output_tokens": 30,
    "cost": 0.000508
  }
}
```

## Drop-in workflow

```bash
#!/usr/bin/env bash
set -euo pipefail

MODEL="google/chirp-3"
FORMAT="wav"                          # wav, mp3, flac, m4a, ogg, webm, aac
AUDIO="audio.wav"
BODY=$(mktemp)
PAYLOAD=$(mktemp)

audio_b64=$(base64 < "$AUDIO" | tr -d '\n')

jq -n --arg model "$MODEL" --arg data "$audio_b64" --arg fmt "$FORMAT" \
  '{model: $model, input_audio: {data: $data, format: $fmt}}' > "$PAYLOAD"

# --data-binary @file keeps the base64 payload off argv (avoids E2BIG / ARG_MAX).
http_code=$(curl -sS -X POST https://openrouter.ai/api/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  --output "$BODY" \
  -w '%{http_code}' \
  --data-binary @"$PAYLOAD")

if [[ "$http_code" != "200" ]]; then
  echo "STT failed (HTTP $http_code):" >&2
  cat "$BODY" >&2
  rm -f "$BODY" "$PAYLOAD"
  exit 1
fi

jq -r '.text' "$BODY"
rm -f "$BODY" "$PAYLOAD"
```

## Discovering STT models

Filter the models endpoint by output modality to list transcription models.

```bash
curl -sS "https://openrouter.ai/api/v1/models?output_modalities=transcription" \
  | jq '.data[] | {id, name, pricing}'
```

Models are provider-namespaced — use the full slug (`google/chirp-3`, `openai/whisper-1`, `openai/whisper-large-v3`), not the short name.

## Parameters

| Field                | Required | Notes                                                                                                     |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `model`              | yes      | Full model slug from `/api/v1/models?output_modalities=transcription`.                                    |
| `input_audio.data`   | yes      | Base64-encoded raw audio bytes. **Not** a data URI — just the base64 payload, no `data:audio/...;base64,` prefix. |
| `input_audio.format` | yes      | `wav`, `mp3`, `flac`, `m4a`, `ogg`, `webm`, or `aac`. Must match the actual bytes. Support varies by provider. |
| `language`           | no       | ISO-639-1 code (`en`, `ja`, `fr`). Auto-detected if omitted.                                              |
| `prompt`             | no       | Context to guide transcription (domain vocabulary, a previous segment). Only some providers honor it — see below. |
| `temperature`        | no       | 0–1. Lower is more deterministic.                                                                         |
| `keyterms`           | no       | Array of domain terms, names, or phrases to bias recognition toward (up to 1000 terms, 1–100 chars each). Only some providers support it — see below. |
| `diarize`            | no       | `true` labels each word with its speaker (`speaker`, plus `speaker_label` when the provider returns one) on the `words` array. Requires `response_format: "verbose_json"` (a `json` request is rejected with a 400) and adds word timestamps on its own. Only some providers support it (400 otherwise); providers may charge extra. |
| `provider`           | no       | Provider routing preferences and passthrough — see below.                                                 |

### Picking an audio format

- **`wav`** / **`flac`** — uncompressed or lossless. Highest quality; largest uploads.
- **`mp3`** / **`m4a`** / **`aac`** — compressed. Smaller payloads, which matters because base64 inflates bytes by ~33% on top of whatever the file already weighs.
- **`webm`** / **`ogg`** — typical for browser recordings (`MediaRecorder`).

The `format` field must match the actual container/codec of the bytes. A file saved as `.wav` that is actually mp3 will be rejected or mis-decoded. When in doubt, confirm with `ffprobe <file>`.

### Boosting vocabulary with `keyterms`

`keyterms` is the provider-agnostic way to hint names, jargon, or product terms. OpenRouter maps it to each provider's native field (a keyword/keyterm list or a vocabulary prompt), so you don't need per-provider passthrough for this.

```json
{
  "model": "openai/whisper-large-v3",
  "input_audio": { "data": "UklGRiQA...", "format": "wav" },
  "keyterms": ["OpenRouter", "Scribe", "PKCE"]
}
```

- If the selected model cannot use keyterms, the request is rejected with a 400 rather than silently ignored — drop `keyterms` or pick another model/provider.
- Providers may enforce stricter limits (fewer terms, shorter terms, restricted characters) and return a 400 naming the problem; some charge extra when keyterms are sent.
- An empty array is treated as absent.
- When `keyterms` is non-empty it takes precedence over the equivalent field in `provider.options.<slug>`.

### Context with `prompt`

`prompt` is a top-level string (or multipart text field) that gives the model context; it is not an instruction to rewrite the transcript, and the output may be identical with or without it.

| Provider | Behavior |
| --- | --- |
| OpenAI, Azure OpenAI, Groq, Together | Forwarded as `prompt` (not supported by OpenAI `gpt-4o-transcribe-diarize`) |
| Alibaba | Mapped to the system message |
| AssemblyAI | Mapped to `config.prompt` only on endpoints with prompted pricing (billed at that rate); otherwise ignored. AssemblyAI ignores `language` when a prompt is applied |
| Others | Ignored — use `keyterms` where supported |

Canonical `prompt` takes precedence over provider-specific prompt options (e.g. `provider.options.groq.prompt`, `provider.options.alibaba.system_prompt`, `provider.options.assemblyai.prompt`), and an empty string clears them. Provider limits still apply (Groq 224 tokens, AssemblyAI 6000 characters).

## Provider routing

`provider` accepts the same routing preferences as chat completions: `order` (provider slugs to try in order), `only` (allowlist), `ignore` (denylist), and `allow_fallbacks` (default `true`; set `false` to fail instead of falling back to providers outside `order`). Data-policy preferences `zdr` and `data_collection` are also accepted.

```json
{
  "model": "openai/whisper-large-v3",
  "input_audio": { "data": "UklGRiQA...", "format": "wav" },
  "provider": { "order": ["groq"], "allow_fallbacks": false }
}
```

## Provider-specific options

Provider passthrough goes under `provider.options.<slug>` and is only forwarded when that provider handles the request. Example — a Groq passthrough option (prefer the top-level `prompt` above for context hints; it overrides `provider.options.groq.prompt`):

```json
{
  "model": "openai/whisper-large-v3",
  "input_audio": { "data": "UklGRiQA...", "format": "wav" },
  "provider": {
    "options": {
      "groq": {
        "prompt": "Expected vocabulary: OpenRouter, API, transcription"
      }
    }
  }
}
```

Options keyed by provider slug are forwarded only when that provider matches; other keys are ignored. Check each provider's upstream docs for available passthrough keys.

## TypeScript (fetch)

```typescript
import fs from "fs";

const audio = await fs.promises.readFile("audio.wav");
const data = audio.toString("base64");

const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/chirp-3",
    input_audio: { data, format: "wav" },
  }),
});

if (!res.ok) {
  throw new Error(`STT failed (HTTP ${res.status}): ${await res.text()}`);
}

const result = await res.json();
console.log(result.text);
```

## Python (requests)

```python
import base64
import os
import requests

with open("audio.wav", "rb") as f:
    data = base64.b64encode(f.read()).decode("utf-8")

res = requests.post(
    "https://openrouter.ai/api/v1/audio/transcriptions",
    headers={
        "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "model": "google/chirp-3",
        "input_audio": {"data": data, "format": "wav"},
    },
)

if not res.ok:
    raise RuntimeError(f"STT failed (HTTP {res.status_code}): {res.text}")

print(res.json()["text"])
```

## Troubleshooting

**Garbled or empty `text`** — the `format` field probably doesn't match the actual bytes, or the audio is silent/corrupted. Confirm with `ffprobe audio.wav`.

**400 with `"Invalid base64"` or silent failure** — `data` must be just base64, not a data URI (`data:audio/wav;base64,...`). Strip the prefix if you copied it from a browser `FileReader`.

**400 with a `ZodError`** — a required field is missing or the wrong type. The body looks like `{"success":false,"error":{"name":"ZodError","message":"[...]"}}` — the nested `message` JSON string names the bad path (commonly `input_audio.data` or `input_audio.format`).

**413 / request too large** — base64 inflates bytes by ~33%, so a large raw file becomes an even larger JSON payload. Use a smaller source file (compressed format, lower sample rate, or trimmed clip).

**Model not found** — use the full slug from `/api/v1/models?output_modalities=transcription` (`google/chirp-3`, not `chirp-3`).

## References

- [STT guide](https://openrouter.ai/docs/guides/overview/multimodal/stt)
- [Models page — filter to transcription output](https://openrouter.ai/models?output_modalities=transcription)
