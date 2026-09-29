# Prompt-injection guardrail

`prompt-injection.ts` checks user messages with OpenRouter's Decisions API
(`choice` primitive, one `injection`/`benign` question) and returns a typed
verdict, not generated text:

```ts
import { PromptInjectionGuardrail } from "./guardrail/prompt-injection.ts";

const guardrail = new PromptInjectionGuardrail(process.env.OPENROUTER_API_KEY);
const verdict = await guardrail.check(userMessage);
// { injected: boolean, probability: number, model: string }

if (verdict.injected) {
  // Do not run the agent or its refund tools. Return the safe response.
}
```

- The agent's refund tools are gated behind this check, before any agent run.
- The decision model build is pinned in `PROMPT_INJECTION_MODEL`.
- `INJECTION_THRESHOLD` (0.5) was set by probing this build: adversarial and
  quoted-injection inputs scored 0.94-1.00; benign refund requests, a refund
  refusal, an off-topic question, and a broken-product report scored at most
  0.05. Re-probe and re-tune when the model build changes.
- Keep the API key server-side.
