Added a standalone TypeScript guardrail; this workspace had no existing agent to connect.

- Returns an injection probability through OpenRouter Decisions.
- Blocks at `≥ 0.5`, before agent execution.
- Stops execution on errors or a 1.5-second timeout.
- Uses pinned Jev 1.13, measured at 101–199 ms across 12 probes.

Type checking and all seven tests passed. Integration instructions are in `README.md`.

Refund tools must still enforce authorization and eligibility independently of the probability.