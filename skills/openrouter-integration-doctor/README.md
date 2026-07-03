# openrouter-integration-doctor

Diagnose and fix a whole OpenRouter **integration** — key/credit health, routing and
fallback config, and a live end-to-end smoke test — with a symptom→diagnosis→native-fix
playbook and runnable probes. The cross-cutting complement to `openrouter-generations`,
which debugs a single request.

## Install

With the [GitHub CLI](https://cli.github.com/) (v2.92.0+):

```bash
gh skill install OpenRouterTeam/skills openrouter-integration-doctor
```

Works with Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Windsurf, and [many more agents](https://cli.github.com/manual/gh_skill_install). Add `--scope user` to install across every project for your current agent, or `--agent claude-code` to target a specific agent.

For other install methods (Claude Code plugin marketplace, Cursor Rules, etc.) see the [root README](../../README.md#installing).

### Manual install

If `gh skill install` fails (e.g. the `gh` CLI is older than v2.92.0, or you hit an auth/network issue), copy the skill directory in manually:

```bash
git clone https://github.com/OpenRouterTeam/skills.git /tmp/or-skills
mkdir -p .github/skills
cp -r /tmp/or-skills/skills/openrouter-integration-doctor .github/skills/
rm -rf /tmp/or-skills
```

## Prerequisites

`OPENROUTER_API_KEY` must be set to a valid OpenRouter API key for the live probes (a
management/provisioning key surfaces the richest `/key` data). Get one at
[openrouter.ai/settings/keys](https://openrouter.ai/settings/keys). The config validator
needs no key and no network.

## What it covers

See [SKILL.md](SKILL.md) for the full reference, including:

- The symptom → diagnosis → OpenRouter-native-fix playbook (402/403/404/429/503/529,
  "No endpoints found", streaming cut-offs, structured-output degrade, ZDR conflicts).
- The canonical 27-value `ApiErrorType` enum and the typed HTTP ladder.
- Splitting a 402 into account-depletion vs key-spend-cap.
- Diagnosing the "overloaded-404" from over-constrained provider preferences.
- Configuring model fallbacks and understanding ZDR union semantics.
- A first-two-days integration-health onboarding checklist.

## Scripts

| Script | Network? | Purpose |
|--------|----------|---------|
| `check-key-credits.ts` | yes | `GET /key` (+ `GET /credits` with a management key) — balance, key spend cap; flags 402 risk. `/credits` is management-key-only; the probe auto-detects key type |
| `validate-fallback-config.ts` | **no** | Offline lint of a request body for routing/fallback/ZDR misconfigurations |
| `smoke-test.ts` | yes | Minimal live `POST /chat/completions` — proves the pipe is open end-to-end |
| `inspect-generation.ts` | yes | `GET /generation` (+`/content`) — cost/routing/streaming diagnosis; bridge to `openrouter-generations`. Retries the brief post-request 404 while the generation indexes |

## Quick start

```bash
# First-time setup (once per installation):
# cd <skill-path>/scripts && npm install

# 1. Is the key valid and funded? (first move on any 402)
npx tsx check-key-credits.ts

# 2. Is the routing/fallback config sound? (offline — no key needed)
npx tsx validate-fallback-config.ts ./request-body.json

# 3. Does a real call complete end-to-end?
npx tsx smoke-test.ts

# 4. Localize a specific failing call, then hand the id to openrouter-generations
npx tsx inspect-generation.ts gen-1234567890 --content
```

## Related Skills

- `openrouter-generations` — inspect a **single** generation ID in exhaustive detail
  (this skill's `inspect-generation.ts` is a thin bridge; use `openrouter-generations` for
  the full per-field dump).
- `openrouter-models` — resolve model slugs and compare context lengths / pricing when a
  404 turns out to be a slug typo.
- `openrouter-analytics` — aggregate spend/volume/latency trends across all generations.
