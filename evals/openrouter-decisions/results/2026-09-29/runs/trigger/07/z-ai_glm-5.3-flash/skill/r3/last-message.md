Done — the guardrail is in place and validated against the live Decisions API.

**What it does**
- Single `noul` question returns a probability directly — no chat completion.
- Code applies the threshold (`0.8` default) and decides `blocked`.
- Criteria explicitly distinguish ordinary refund requests from override/redirect attempts.

**Files**
- `src/prompt-injection-guard.ts:1` — Decisions API call, typed result.
- `examples/support-agent.ts:1` — wiring in front of the agent.

**Live validation**
- Ordinary refund message → `P(injection) = 0.02`, allowed.
- Direct override attempt → `P(injection) = 0.99`, blocked.

Run it with `npx tsx examples/support-agent.ts "<user message>"`.