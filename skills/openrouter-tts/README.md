# openrouter-tts

Synthesize speech from text via OpenRouter's synchronous `POST /api/v1/audio/speech`. Covers basic usage with `curl`, model/voice discovery, format selection (mp3 vs pcm), provider-specific options (e.g. OpenAI `instructions`), and OpenAI-SDK compatibility.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.90.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-tts
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

## Prerequisites

- `OPENROUTER_API_KEY` environment variable. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).
- `curl` and `jq` (for the bash workflow), or the OpenAI Python/TypeScript SDK.

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- A drop-in bash script that handles headers, error bodies, and generation ID capture
- Discovering TTS models via `/api/v1/models?output_modalities=speech`
- Picking between `mp3` and `pcm`, and avoiding the format/extension mismatch that accounts for most "empty audio" reports
- Provider passthrough (`provider.options.<slug>`) including OpenAI's `instructions` for tone/pacing
- OpenAI SDK compatibility — swap the base URL and the existing client code works
- Splitting and concatenating long inputs
