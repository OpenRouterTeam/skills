# Integration-health onboarding checklist

The pass an FDE runs in a customer's first two days to catch the failures this skill
diagnoses *before* they page someone. Ordered outside-in: offline/config checks first,
live calls last. Each item names the probe or endpoint that verifies it.

## Day 1 — wiring and account

- [ ] **Key valid and funded.** `check-key-credits.ts` — account balance > 0 and this
      key's spend cap (if any) has headroom. Splits account-depletion vs key-cap so a
      future 402 is unambiguous. Account balance needs a management key
      (`--management-key` / `OPENROUTER_MANAGEMENT_KEY`); the key-level view works with
      the runtime key itself.
- [ ] **Spend guardrails exist.** Per-key limits set via the Management API; agent loops
      bounded with `stop_server_tools_when: {max_cost}`. Prevents the "bill 10x'd
      overnight" surprise.
- [ ] **Config lints clean.** `validate-fallback-config.ts ./their-request-body.json`
      (offline) — no `error`-severity findings. Catches the overloaded-404, silent
      structured-output degrade, and ZDR narrowing before the first real failure.
- [ ] **Pipe is open.** `smoke-test.ts` — a live call completes and returns the model /
      provider / cost that served it. If this passes but the customer's own call fails,
      the fault is their request shape, not the wiring.

## Day 2 — resilience and observability

- [ ] **Model fallback in place.** A `models[]` array of validated substitutes on every
      production path; `allow_fallbacks:true` unless compliance forbids the alternates.
      See [fallback-and-zdr.md](fallback-and-zdr.md).
- [ ] **Feature routing pinned.** Any dependence on strict `json_schema`, tools, or
      reasoning is guarded with `provider.require_parameters:true` so fallback can't
      silently pick a provider that ignores it.
- [ ] **Compliance floor known.** If ZDR / no-training is required, `GET /endpoints/zdr`
      confirms the model set still has provider coverage. Thin coverage is surfaced as a
      capacity constraint, not routed around.
- [ ] **Streaming handled correctly.** If the customer streams, they parse the final SSE
      chunk and treat `finish_reason:"error"` as a failure. Confirm — this is the single
      most common silent-failure mode.
- [ ] **Cost observability.** They can pull authoritative per-request cost/routing via
      `inspect-generation.ts <id>` (or the `openrouter-generations` skill) and group by
      `session_id` for attribution. Reconcile against in-band `usage.cost`.
- [ ] **Error handling switches on `ApiErrorType`**, not raw provider strings or bare HTTP
      codes. See [error-taxonomy.md](error-taxonomy.md) for the 27-value enum. This is the
      difference between an integration that degrades gracefully and one that pages on
      every provider hiccup.

## Escalation reflex

- A known-good key returning **503** is OpenRouter-side (the 401→503 post-mortem). Check
  status.openrouter.ai and escalate; do not send the customer key-hunting.
- Novel provider errors surface as `unmapped` — capture the raw message +
  `echo_upstream_body` and escalate rather than guess.

## Framing

This checklist is v0.1, built from public evidence and designed to be corrected. It is the
integration-health floor, not a substitute for the customer's own SLAs — confidence about
shape, humility about a given customer's internals.
