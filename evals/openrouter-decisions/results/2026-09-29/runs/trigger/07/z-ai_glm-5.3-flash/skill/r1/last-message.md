All four cases route correctly end-to-end through the module. Here's what I built:

**What was added**
- `src/prompt-injection-guard.ts` — a single-function guardrail that calls OpenRouter's Decisions API (one `noul` question, ~120–300ms, ~$0.00002/call) and returns `{ probability, injected, ambiguous }`.
- Pinned to `typesafe/jev-1.13-20260917` (canonical slug, probed live).
- Gate at `0.50`; probabilities in `[0.35, 0.65)` flag `ambiguous` so you can route those to a review queue instead of auto-blocking.
- Probe results confirm clear separation: injections hit 0.98–0.99, legitimate messages (including refund requests) sit at 0.01–0.03.

**Usage**
```ts
import { checkPromptInjection } from "./src/prompt-injection-guard";

const result = await checkPromptInjection(userMessage);
if (result.injected) {
  // block the agent's tools for this turn
} else if (result.ambiguous) {
  // optionally route to human review
}
// else: proceed with the agent
```

**To swap models later** — change `DECISION_MODEL` to another canonical slug from `GET /api/v1/models?output_modalities=decisions`, then re-run the probe set to re-tune the threshold. The current model returns ~120ms latency and zero completion cost per call.