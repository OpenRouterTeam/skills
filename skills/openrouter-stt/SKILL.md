---
name: openrouter-stt
description: Transcribe speech to text using OpenRouter's speech-to-text API. Use when the user asks to transcribe audio, convert speech to text, extract a transcript from a recording or meeting, caption a video's audio, or mentions STT, speech-to-text, ASR, or transcription.
---

# OpenRouter Speech-to-Text

Transcribe audio via `POST /api/v1/audio/transcriptions` using `curl`. Requires `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys). If unset, stop and ask.

**This endpoint is not OpenAI-compatible.** The body is JSON with base64 audio under `input_audio: { data, format }` — not `multipart/form-data` with a `file` field the way OpenAI's `/v1/audio/transcriptions` works. Do not point the OpenAI SDK at this endpoint; it will send the wrong shape. Use `curl`, `fetch`, or `requests` directly.

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

audio_b64=$(base64 < "$AUDIO" | tr -d '\n')

payload=$(jq -n --arg model "$MODEL" --arg data "$audio_b64" --arg fmt "$FORMAT" \
  '{model: $model, input_audio: {data: $data, format: $fmt}}')

http_code=$(curl -sS -X POST https://openrouter.ai/api/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  --output "$BODY" \
  -w '%{http_code}' \
  -d "$payload")

if [[ "$http_code" != "200" ]]; then
  echo "STT failed (HTTP $http_code):" >&2
  cat "$BODY" >&2
  rm -f "$BODY"
  exit 1
fi

jq -r '.text' "$BODY"
rm -f "$BODY"
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
| `temperature`        | no       | 0–1. Lower is more deterministic.                                                                         |
| `provider`           | no       | Provider passthrough — see below.                                                                         |

### Picking an audio format

- **`wav`** / **`flac`** — uncompressed or lossless. Highest quality; largest uploads.
- **`mp3`** / **`m4a`** / **`aac`** — compressed. Smaller payloads, which matters because base64 inflates bytes by ~33% on top of whatever the file already weighs.
- **`webm`** / **`ogg`** — typical for browser recordings (`MediaRecorder`).

The `format` field must match the actual container/codec of the bytes. A file saved as `.wav` that is actually mp3 will be rejected or mis-decoded. When in doubt, confirm with `ffprobe <file>`.

## Provider-specific options

Provider passthrough goes under `provider.options.<slug>` and is only forwarded when that provider handles the request. Example — Groq's `prompt` for vocabulary hinting:

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
