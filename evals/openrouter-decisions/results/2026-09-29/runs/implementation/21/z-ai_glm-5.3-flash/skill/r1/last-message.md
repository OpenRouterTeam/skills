Done — urgency scoring is implemented, probed live, and validated. Summary:

- `src/incident-urgency.ts:1` — Decision-model scorer using OpenRouter Decisions `score` primitive, pinned to `typesafe/jev-1.13-20260917`, with 1–5 mapping logic.
- `src/rate-cli.ts:1` — CLI to rate a JSON incident (`{"report": "...", "service": "..."}`).
- `probe/run.ts:1`, `probe/cases.json:1` — Six-case probe set, including negation and adversarial wording.
- `README.md:1` — Setup, probe workflow, and production integration guide.
- Tests: 3/3 passing, TypeScript clean.
- Live probe: all 6 cases scored correctly (1, 2, 3, 5, 5, 1), including the deliberately misleading adversarial case.