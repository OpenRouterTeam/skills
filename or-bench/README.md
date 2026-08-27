# or-bench

A reproducible benchmark for measuring whether coding agents can build working
OpenRouter integrations using public documentation and tools — in the spirit of
[Tempo's stable-bench-v1](https://tempo.xyz/developers/blog/introducing-stable-bench-v1).

or-bench measures three things per task:

- **Efficacy** — did the agent produce a working integration? Verified against
  live side-effects: the verifier queries the OpenRouter
  [generation endpoint](https://openrouter.ai/docs/api-reference/get-a-generation)
  to confirm the agent's code actually made the expected API calls (model,
  streaming, token accounting).
- **Quality** — does the integration follow current best practices? (LLM-judged
  rubric; planned for v2.)
- **Efficiency** — turns, tokens, and cost, read from the harness trajectory logs.

## Architecture

or-bench is built on [Harbor](https://harborframework.com), the open-source
harness used by Terminal-Bench. Each task is a versioned directory with four
parts:

| Part | File(s) | Notes |
|---|---|---|
| Instruction | `instruction.md` | The prompt a developer would give an agent |
| Environment | `environment/Dockerfile`, `task.toml` | Runtime, credentials, network access |
| Oracle | `solution/solve.sh` | Hidden reference solution proving the task is solvable — agents never see it |
| Verifier | `tests/test.sh`, `tests/verify.mjs` | Independent grader; writes a 0–1 reward to `/logs/verifier/reward.txt` |

The agent runs inside a container with `OPENROUTER_API_KEY` injected and writes
its submission as a project under `/app` plus an artifact at `/app/out.json`.
The verifier inspects the artifact and cross-checks it against OpenRouter's
generation API — the moral equivalent of Tempo verifying deployments on-chain.

## Tasks

| Task | Tests |
|---|---|
| [`streaming-chat`](tasks/streaming-chat) | Streaming chat completion with usage accounting via the OpenRouter API |
| [`structured-outputs`](tasks/structured-outputs) | Strict JSON Schema structured outputs (`response_format: json_schema`) |

## Running

```bash
uv tool install harbor

export OPENROUTER_API_KEY=sk-or-...   # key used by the task env AND the verifier

# Sanity check: oracle solutions should score 1.0
harbor run --path tasks/streaming-chat --agent oracle
harbor run --path tasks/structured-outputs --agent oracle

# Evaluate a real agent
harbor run --path tasks/streaming-chat --agent claude-code --model anthropic/claude-sonnet-4-5 \
  --ae OPENROUTER_API_KEY=$OPENROUTER_API_KEY
```

Use a dedicated, disposable OpenRouter runtime key per run so verifier lookups
of generation IDs are scoped to that run's traffic.

## Scoring

Each verifier awards partial credit across sub-checks (artifact schema, live
generation lookup, streamed flag, model pinning, token accounting, result
correctness) and writes the total to `/logs/verifier/reward.txt`. Compare
rewards alongside token/turn counts from Harbor's trial output across agents
and across documentation revisions.

## Roadmap (v2)

- Pinned-docs sidecar: serve a fixed revision of openrouter.ai/docs inside the
  environment and rewrite egress for known doc URLs, so runs are reproducible
  across doc changes and doc changes can be A/B tested against bench scores.
- LLM-as-judge quality rubric via `[verifier.env]` judge keys.
- More tasks: OAuth PKCE key provisioning, tool-calling agent loops with stop
  conditions, model routing with `:free`/`:nitro` variants and fallbacks,
  analytics API queries with a management key.
- MCP-on/off comparison runs (`[environment].mcp_servers`).
