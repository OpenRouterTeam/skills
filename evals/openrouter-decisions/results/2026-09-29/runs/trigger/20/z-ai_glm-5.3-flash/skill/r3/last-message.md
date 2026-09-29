Implemented the Decisions API escalation routing in `escalation-router/lib.ts:22`. Summary:

- Replaced the chat-completion "yes" check with a typed `noul` decision: `P(can answer)`.
- Added code-side gates: `>=0.8` → answer, `(0.2, 0.8)` → review queue, `<=0.2` → human handoff.
- Gate logic is isolated in `escalation-router/gates.ts:8` with named thresholds and passing unit tests (`gate tests passed`).
- `README.md` documents the state requirements and call pattern.

Caveats: model probing and a live decision call require an `OPENROUTER_API_KEY` and network access to the OpenRouter catalog, which weren't available here. The default model is set in `lib.ts:35` and can be overridden via `DECISION_MODEL`.