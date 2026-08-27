# openrouter-stt

Transcribe speech to text via OpenRouter's `POST /api/v1/audio/transcriptions`. Covers basic usage with `curl`, model discovery, audio format selection, provider-specific options, and zero-dep TypeScript (`fetch`) and Python (`requests`) examples.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-stt
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

- `OPENROUTER_API_KEY` environment variable. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).
- `curl` and `jq` (for the bash workflow), or Python `requests` / TypeScript `fetch`.

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- Both request shapes: base64 JSON (`input_audio`) and OpenAI-style `multipart/form-data` (works with the official OpenAI SDKs)
- A drop-in bash script that base64-encodes audio, posts JSON, and extracts the transcript
- Discovering STT models via `/api/v1/models?output_modalities=transcription`
- Audio format guidance (`wav`, `mp3`, `flac`, `m4a`, `ogg`, `webm`, `aac`) and avoiding format/bytes mismatch
- Provider passthrough (`provider.options.<slug>`) for things like Groq's vocabulary `prompt`
- Zero-dep TypeScript (`fetch`) and Python (`requests`) examples
