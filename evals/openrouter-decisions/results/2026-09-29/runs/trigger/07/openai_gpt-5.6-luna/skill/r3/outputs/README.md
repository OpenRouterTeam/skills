# Support-agent prompt-injection guardrail

`checkPromptInjection` sends the untrusted message as a named state field to OpenRouter's Decisions API. It uses a `noul` question and returns `P(prompt injection)` plus a code-owned action; it never asks for generated text.

Configure the server environment with:

```sh
OPENROUTER_API_KEY=...
OPENROUTER_DECISION_MODEL=<pinned canonical decision-model build>
```

Run `guardSupportMessage` before the support agent sees the message or can call tools. `allow` may continue, while `review` and `block` must not permit refund or other tool execution. The wrapper treats timeouts, API errors, and malformed responses as review. Probe representative benign, ambiguous, empty, negated, and adversarial messages against the exact model build before changing the thresholds.
