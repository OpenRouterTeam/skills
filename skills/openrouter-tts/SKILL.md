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

Voice cloning support is an endpoint capability, not a models-list field. After choosing a model, inspect its provider endpoints via `GET /api/v1/models/{author}/{slug}/endpoints` and use reference audio only where `supports_voice_cloning` is `true`. Two more flags gate the richer reference modes: `supports_multiple_audio_references` (more than one clip) and `supports_image_reference` (an `image_url` reference, either on its own for voice design or alongside a clip as a scene image; which shape applies is per model). Requests are only routed to endpoints whose flags allow the references sent:

```bash
curl -sS "https://openrouter.ai/api/v1/models/fish-audio/s1/endpoints" \
  | jq '.data.endpoints[] | {provider_name, model_id, supports_voice_cloning, supports_multiple_audio_references, supports_image_reference}'
```

Voices are provider-namespaced: OpenAI uses short names (`alloy`, `nova`), Voxtral encodes language + persona + emotion (`en_paul_happy`), Kokoro prefixes with language/gender (`af_bella` = American female Bella).

## Parameters

| Field             | Required | Notes                                                                                                             |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `model`           | yes      | TTS model slug (e.g. `openai/gpt-4o-mini-tts-2025-12-15`, `mistralai/voxtral-mini-tts-2603`).                     |
| `input`           | yes      | The text to synthesize, or an array of turns for multi-speaker input — see [Multi-speaker input](#multi-speaker-input). |
| `voice`           | no       | Voice identifier. Look up the exact set for your model in `supported_voices` on the models endpoint (see the discovery section above). Voices are provider-namespaced — e.g. `alloy` is an OpenAI voice and will not work on Voxtral or Kokoro. Some models/providers require a voice; follow the endpoint's declared requirements. |
| `response_format` | no       | `mp3` or `pcm`. Default is `pcm`. **Set this explicitly** — the default is usually not what a user wants to save. |
| `instructions`    | no       | Delivery instructions for the whole request (tone, pacing, emotion, e.g. `"Speak in a warm and friendly tone."`). Supported by OpenAI `gpt-4o-mini-tts`, Gemini TTS, and Fish Audio models; ignored by other providers. |
| `speed`           | no       | Playback multiplier (e.g. `1.25`). Honored by OpenAI TTS. Other providers may accept and ignore it, or reject unknown fields — check the provider's behavior if it matters. |
| `input_references` | no       | Stateless voice cloning or voice design. Audio mode: one to three `input_audio` parts (each with base64/data-URI `data` **or** a public `url`, plus optional `format`), each optionally paired with a transcript `text` part. Audio mode may add at most one `image_url` scene image on providers that support it (HeyGen Voice). Image mode: exactly one `image_url` part on its own. Two images are rejected; an empty array means no reference. See [Voice cloning](#voice-cloning) for routing requirements. |
| `provider`        | no       | Data policy routing (`zdr`, `data_collection`) and provider passthrough under `provider.options` — see below. With `zdr: true` the request routes only to Zero Data Retention endpoints; `data_collection: "deny"` excludes providers that store or train on data. Other routing preferences (`order`, `only`, `ignore`) are not applied to speech requests. |

### Voice cloning

Pass one reference-audio part, optionally accompanied by its transcript:

```bash
curl -sS -X POST https://openrouter.ai/api/v1/audio/speech \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fish-audio/s1",
    "input": "Welcome to the show.",
    "input_references": [
      {
        "type": "input_audio",
        "input_audio": {
          "data": "data:audio/wav;base64,<base64-audio>",
          "format": "wav"
        }
      },
      {
        "type": "text",
        "text": "Welcome to the show."
      }
    ],
    "response_format": "mp3"
  }' \
  --output cloned-voice.mp3
```

Each `input_audio` needs exactly one of `data` (raw base64 or a data URI, max 20 MiB of base64 / 15 MiB decoded) or `url` (public http(s) URL; OpenRouter downloads it, 15 MiB max, and forwards the bytes, never the URL). `format` is optional; most providers detect it from the audio bytes. With a single clip the transcript may come before or after it.

**Multiple clips.** Send up to three `input_audio` parts; with more than one clip, each transcript `text` part must immediately follow the clip it transcribes. On providers that support multiple references, the Nth clip is addressable from `input` as `@AudioN` (e.g. `"input": "@Audio1 Welcome back to the show. @Audio2 Thanks for having me."`). Only routed to endpoints with `supports_multiple_audio_references: true`. Seed Audio 1.0 (`bytedance-seed/seed-audio-1-0`, currently the only multi-clip model) validates placeholders with a 400: with more than one clip every clip must be referenced at least once, a placeholder for a clip you did not send (or with no audio references) is rejected, and with a single clip the placeholder is optional but must be `@Audio1`. Seed Audio ignores transcripts and rejects requests that send both `voice` and `input_references`.

**Image reference (voice design).** Instead of audio, send exactly one image describing the desired voice; Seed Audio's voice-design mode accepts no `input_audio` clips alongside it. Only routed to endpoints with `supports_image_reference: true`. The `url` is a JPEG, PNG, or WebP as a base64 data URI or a public http(s) URL (downloaded, 15 MiB max):

```json
"input_references": [
  { "type": "image_url", "image_url": { "url": "https://example.com/speaker.png" } }
]
```

**Scene image.** HeyGen Voice (`heygen/heygen-voice-1`) clones the reference recording on each request and can condition the voice on one optional `image_url` picture of the speaker in their setting (a quiet room stays clean, a car or stage adds matching acoustics). Send it next to the `input_audio` part, omit `voice` (the recording is the voice), and name the recording's language with `provider.options.heygen.language`. The recording must be WAV or MP3 of clear speech (only the first 3 minutes are used); the image is JPEG, PNG, or WebP. HeyGen Voice rejects an image without a recording, and Seed Audio rejects a recording together with an image, each with a 400:

```json
{
  "model": "heygen/heygen-voice-1",
  "input": "Welcome aboard, please fasten your seat belts.",
  "response_format": "pcm",
  "input_references": [
    { "type": "input_audio", "input_audio": { "data": "data:audio/mpeg;base64,SUQzBAAAAAAA..." } },
    { "type": "image_url", "image_url": { "url": "https://example.com/pilot-in-cockpit.jpg" } }
  ],
  "provider": { "options": { "heygen": { "language": "en" } } }
}
```

### Non-speech prompts

Most models read `input` aloud verbatim. Seed Audio 1.0 instead treats `input` as a prompt, so it can describe delivery or non-speech audio (sound effects, ambience, a scene). Omit `voice` and `input_references` to let the model infer everything from the prompt. Limits (400 otherwise): `input` up to 3000 characters, `speed` 0.5–2.0, at most 120 seconds of generated audio.

```json
{
  "model": "bytedance-seed/seed-audio-1-0",
  "input": "Heavy rain falling on a tin roof with distant rolling thunder, no voices.",
  "response_format": "mp3"
}
```

### Multi-speaker input

Gemini TTS models and Fish Audio models other than S1 can voice a conversation in one request. Pass `input` as an array of turns instead of a string. Each turn has `text` and may set its own `voice` and `instructions`; a turn without them falls back to the top-level `voice` / `instructions`. Turns are synthesized in order into one audio stream. Other providers (including Fish Audio S1) return a 400 for array input, and Fish Audio rejects multi-speaker input combined with reference audio (`input_references`).

```json
{
  "model": "google/gemini-3.8-flash-lite-tts",
  "input": [
    { "text": "How's it going today, Jane?", "voice": "Kore" },
    { "text": "Not too bad, how about you?", "voice": "Puck", "instructions": "tired, yawning" }
  ],
  "instructions": "cheerful",
  "response_format": "pcm"
}
```

### Picking a format

- **`mp3`** (`audio/mpeg`) — compressed, ready to play in any audio app. Default choice for files the user will listen to or share.
- **`pcm`** (`audio/pcm;rate=<rate>;channels=<n>`) — uncompressed raw samples. The response `Content-Type` carries the sample rate and channel count (e.g. `rate=24000;channels=1` for OpenAI TTS), which you'll need if you wrap the bytes into a WAV container. Lower latency for real-time streaming pipelines, but not directly playable on its own. Pick this only when the user explicitly wants raw audio or is piping into a streaming system.

Match the file extension to the format — saving pcm bytes as `.mp3` produces a file no player will open, and this is the most common cause of "empty/corrupted audio" reports.

## Provider-specific options

Use the top-level `instructions` parameter to steer tone, accent, pacing, or emotion — OpenRouter forwards it natively to OpenAI and sends it as `speech_metadata.style` to Gemini (Gemini reads `input` verbatim, so directions written into the text get spoken aloud). For Fish Audio, OpenRouter prepends `instructions` as a bracketed direction (e.g. `[whispering]`) to the input or to each turn, and Fish bills those added characters. `provider.options.openai.instructions` is still accepted as a fallback, but the top-level field wins when both are set.

Other provider passthrough goes under `provider.options.<slug>` and is only forwarded when that provider handles the request:

```json
{
  "model": "google/gemini-3.8-flash-lite-tts",
  "input": "Have a wonderful day!",
  "voice": "Kore",
  "instructions": "warm and friendly",
  "response_format": "pcm",
  "provider": {
    "options": {
      "google-ai-studio": { "temperature": 0.7 }
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

TTS models have per-request character limits (usually a few thousand characters) and most are priced **per character of input**, so there's no penalty to splitting. (Some audio generation models, such as Seed Audio 1.0, are priced per second of generated audio instead, reported under `pricing.completion`.) For anything long (chapters, articles, scripts):

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
