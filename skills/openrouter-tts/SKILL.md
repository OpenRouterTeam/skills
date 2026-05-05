---
name: openrouter-tts
description: Generate speech audio from text using OpenRouter's text-to-speech API. Use when the user asks to synthesize speech, narrate text, create a voiceover, generate an audiobook clip, read text aloud, convert text to an audio file, or mentions TTS, text-to-speech, or voice synthesis.
---

# OpenRouter Text-to-Speech

Synthesize speech via `POST /api/v1/audio/speech` using `curl`. The endpoint is OpenAI-compatible, so the OpenAI SDKs work by pointing them at `https://openrouter.ai/api/v1`. Requires `OPENROUTER_API_KEY` (get one at https://openrouter.ai/keys). If unset, stop and ask.

## One call, raw bytes back

The response body is the audio bytes — write them to a file with the extension matching `response_format`. It is **not JSON**; error responses are, so only try to parse JSON when the status is non-200.

Two response headers are worth keeping:

- `Content-Type` — `audio/mpeg` for mp3; for pcm it includes the sample rate and channel count, e.g. `audio/pcm;rate=24000;channels=1`. Parse these parameters if you need to wrap the raw bytes into a WAV container.
- `X-Generation-Id` — the generation ID (format `gen-tts-<timestamp>-<suffix>`), useful for tracking, debugging, and cost lookups.

## Drop-in workflow

```bash
#!/usr/bin/env bash
set -euo pipefail

MODEL="openai/gpt-4o-mini-tts-2025-12-15"
VOICE="alloy"
FORMAT="mp3"                          # mp3 or pcm
INPUT="Hello! This is a text-to-speech test."
OUTPUT="speech-$(date +%Y%m%d-%H%M%S).${FORMAT}"
HEADERS=$(mktemp)

payload=$(jq -n --arg model "$MODEL" --arg input "$INPUT" \
               --arg voice "$VOICE" --arg fmt "$FORMAT" \
  '{model: $model, input: $input, voice: $voice, response_format: $fmt}')

http_code=$(curl -sS -X POST https://openrouter.ai/api/v1/audio/speech \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -D "$HEADERS" \
  --output "$OUTPUT" \
  -w '%{http_code}' \
  -d "$payload")

if [[ "$http_code" != "200" ]]; then
  echo "TTS failed (HTTP $http_code):" >&2
  cat "$OUTPUT" >&2                   # error body is JSON, not audio
  rm -f "$OUTPUT" "$HEADERS"
  exit 1
fi

gen_id=$(grep -i '^x-generation-id:' "$HEADERS" | awk '{print $2}' | tr -d '\r')
rm -f "$HEADERS"
echo "Saved $(realpath "$OUTPUT") (generation_id=${gen_id:-unknown})"
```

## Discovering TTS models and voices

Filter the models endpoint by output modality to list speech models. Each model carries a `supported_voices` array with the exact voice IDs that provider accepts.

```bash
# Models + voices in one shot
curl -sS "https://openrouter.ai/api/v1/models?output_modalities=speech" \
  | jq '.data[] | {id, name, supported_voices, pricing}'

# Just the voices for a specific model
curl -sS "https://openrouter.ai/api/v1/models?output_modalities=speech" \
  | jq -r '.data[] | select(.id=="openai/gpt-4o-mini-tts-2025-12-15") | .supported_voices[]'
```

Voices are provider-namespaced: OpenAI uses short names (`alloy`, `nova`), Voxtral encodes language + persona + emotion (`en_paul_happy`), Kokoro prefixes with language/gender (`af_bella` = American female Bella).

## Parameters

| Field             | Required | Notes                                                                                                             |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `model`           | yes      | TTS model slug (e.g. `openai/gpt-4o-mini-tts-2025-12-15`, `mistralai/voxtral-mini-tts-2603`).                     |
| `input`           | yes      | The text to synthesize.                                                                                           |
| `voice`           | yes      | Voice identifier. Look up the exact set for your model in `supported_voices` on the models endpoint (see the discovery section above). Voices are provider-namespaced — e.g. `alloy` is an OpenAI voice and will not work on Voxtral or Kokoro. |
| `response_format` | no       | `mp3` or `pcm`. Default is `pcm`. **Set this explicitly** — the default is usually not what a user wants to save. |
| `speed`           | no       | Playback multiplier (e.g. `1.25`). Honored by OpenAI TTS. Other providers may accept and ignore it, or reject unknown fields — check the provider's behavior if it matters. |
| `provider`        | no       | Provider passthrough — see below.                                                                                 |

### Picking a format

- **`mp3`** (`audio/mpeg`) — compressed, ready to play in any audio app. Default choice for files the user will listen to or share.
- **`pcm`** (`audio/pcm;rate=<rate>;channels=<n>`) — uncompressed raw samples. The response `Content-Type` carries the sample rate and channel count (e.g. `rate=24000;channels=1` for OpenAI TTS), which you'll need if you wrap the bytes into a WAV container. Lower latency for real-time streaming pipelines, but not directly playable on its own. Pick this only when the user explicitly wants raw audio or is piping into a streaming system.

Match the file extension to the format — saving pcm bytes as `.mp3` produces a file no player will open, and this is the most common cause of "empty/corrupted audio" reports.

## Provider-specific options

Provider passthrough goes under `provider.options.<slug>` and is only forwarded when that provider handles the request. The most useful one is OpenAI's `instructions`, which steers tone, accent, pacing, or emotion without retraining:

```json
{
  "model": "openai/gpt-4o-mini-tts-2025-12-15",
  "input": "Welcome to the show.",
  "voice": "alloy",
  "response_format": "mp3",
  "provider": {
    "options": {
      "openai": {
        "instructions": "Speak in a warm, friendly tone with a slow pace."
      }
    }
  }
}
```

For other providers, check each provider's upstream docs for available passthrough keys — naming conventions vary (camelCase for OpenAI/Google, snake_case for most others).

## OpenAI SDK compatibility

Because the endpoint mirrors OpenAI's `/audio/speech`, both OpenAI SDKs work by swapping the base URL. Prefer this when the user is already in a Python/TypeScript project and doesn't want to shell out.

```python
# Python — streaming write to file
import os
from openai import OpenAI

client = OpenAI(base_url="https://openrouter.ai/api/v1",
                api_key=os.environ["OPENROUTER_API_KEY"])

with client.audio.speech.with_streaming_response.create(
    model="openai/gpt-4o-mini-tts-2025-12-15",
    input="The quick brown fox jumps over the lazy dog.",
    voice="nova",
    response_format="mp3",
) as response:
    response.stream_to_file("output.mp3")
```

```typescript
// TypeScript — collect bytes, write once
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const response = await client.audio.speech.create({
  model: "openai/gpt-4o-mini-tts-2025-12-15",
  input: "The quick brown fox jumps over the lazy dog.",
  voice: "nova",
  response_format: "mp3",
});

await fs.promises.writeFile(
  "output.mp3",
  Buffer.from(await response.arrayBuffer()),
);
```

## Long inputs

TTS models have per-request character limits (usually a few thousand characters) and are priced **per character of input**, so there's no penalty to splitting. For anything long (chapters, articles, scripts):

1. Split the text at sentence or paragraph boundaries — never mid-word.
2. Synthesize each chunk with the same `model` + `voice` so prosody stays consistent.
3. Concatenate the resulting audio files. For mp3, `ffmpeg -i "concat:part1.mp3|part2.mp3" -c copy out.mp3` works for simple cases; for mixed bitrates or tight seams, re-encode via `ffmpeg -f concat -safe 0 -i list.txt output.mp3`.

Splitting also improves time-to-first-audio if you stream chunks to a user as they're generated.

## Troubleshooting

**"Empty" or unplayable audio file** — almost always a format/extension mismatch. Check `Content-Type` in the response headers: `audio/pcm` saved as `.mp3` will not play. Either re-request with `response_format: "mp3"` or save with the matching extension.

**400 with `"Model X does not exist"`** — the slug is wrong. Use the full dated slug from the models endpoint (`openai/gpt-4o-mini-tts-2025-12-15`, not `gpt-4o-mini-tts`).

**400 with a `ZodError`** — a required field is missing or the wrong type. The body looks like `{"success":false,"error":{"name":"ZodError","message":"[...]"}}` — the nested `message` JSON string names the bad path (e.g. `"path":["voice"]`).

**`speed` has no effect** — the provider probably doesn't support it. OpenAI TTS honors it; for other providers, check upstream docs before relying on it.

## References

- [TTS guide](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [Models page — filter to speech output](https://openrouter.ai/models?output_modalities=speech)
