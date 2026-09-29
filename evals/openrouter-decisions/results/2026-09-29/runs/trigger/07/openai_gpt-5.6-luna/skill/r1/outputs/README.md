# Support-agent prompt-injection guardrail

`checkPromptInjection` uses OpenRouter's Decisions API (`/api/alpha/decisions`) with a single `noul` question. It returns the model's probability that the user message is a prompt injection; it does not generate a chat response.

Call it before routing a message to the support agent or exposing refund-capable tools:

```ts
const guard = await checkPromptInjection(userMessage);
if (!guard.allowTools) {
  // Do not call refund or other privileged tools. Escalate or ask for review.
}
```

Set `OPENROUTER_API_KEY` server-side. The guard uses the pinned `upstage/solar-decide-20260928` build, a 1.5-second timeout, and fails closed on API errors. The `0.8` threshold is deliberately named and should be calibrated with representative/adversarial probes before production rollout.
