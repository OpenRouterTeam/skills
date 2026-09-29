# Support prompt-injection guard

Server-side TypeScript guard for string messages, using one OpenRouter Decisions API `noul` question. It returns the estimated probability of a prompt-injection attempt, with a code-side allow/block decision. No chat completion or generated-label parsing is involved.

This workspace did not contain a support agent. `src/guard.ts` provides the check and an integration wrapper; connect the wrapper to your agent's existing entry point.

```sh
npm ci
export OPENROUTER_API_KEY='your-server-side-key'
npm test
npm run typecheck
```

```ts
import { createInjectionGuard, guardSupportAgent } from './src/guard.ts';

const check = createInjectionGuard();
const decision = await check('My order arrived broken. Can I get a refund?');
// { action: 'allow', probability: <number from 0 to 1>, model: <build>,
//   reason: 'scored', latencyMs: <number> }

// runSupportAgent is your existing server-side agent function.
const handleMessage = guardSupportAgent(runSupportAgent);
const response = await handleMessage(userMessage);
// status === 'blocked': agent was never invoked.
// status === 'completed': response.result contains its output.
```

Call the wrapper for every new user message, before adding that message to agent history or starting the agent/tool loop. Handle `blocked` in the application with a refusal or your existing support escalation path. Do not fall through to the unguarded agent on errors. Only `probability` is the raw model estimate; `action` is application policy.

Messages scoring `>= 0.5` are blocked. Empty, non-string, and over-8,000-byte messages are rejected locally, without truncation or an API call. Timeout (1.5 seconds), missing credentials, API errors, malformed answers, out-of-range probabilities, or an unexpected model build block execution with `probability: null`; an unavailable check is not a measured probability. No retries add latency to the request path. The default logger records probability, resolved model, action, reason, and elapsed time without customer text or credentials.

The guard cannot authorize refunds. The refund tool must independently enforce authenticated order ownership, eligibility, amount/currency limits, and duplicate-refund prevention against trusted server-side records. Use the existing approval path when those checks cannot establish authorization. User claims of manager approval and low injection probabilities are not authorization. These checks belong inside the refund tool so every caller is covered. The agent and tool implementations were absent here, so those application checks could not be modified.

## Model selection and evidence

`DECISION_MODEL` pins `typesafe/jev-1.13-20260917`, selected from the live catalog. The comparison in `probes/results.json` covers legitimate refund requests, overrides, role impersonation, secret extraction, attempts to manipulate the classifier, a quoted attack report, negation, an ambiguous exception request, and off-topic text. Empty input is rejected in code. `probes/catalog.json` records context, prices, and providers.

At the 0.5 gate, Jev matched all 10 nonempty expected outcomes: benign probabilities were 0.01–0.19 and attack probabilities were 0.99. Calls took 130–292 ms and cost about $0.000019 each in this run. Kev also passed, with lower cost but 503–1,026 ms latency; Solar blocked the benign quoted security report (0.568106). Respan candidates rejected this named-field state format; those errors do not establish their classification quality. Jev's 32,000-token context accommodates the bounded input, and the catalog listed one provider, TypeSafe.

Retain 0.5 because it separates the observed examples. This is a small synthetic smoke test, not proof of calibration or adversarial robustness; the decision model itself can be manipulated. Refund authorization remains deterministic even when the guard misses an attack. The check covers the current user string, not injections in tool results, retrieved documents, or earlier conversation context.

```sh
npm run probe           # Compare the same questions across current catalog candidates
npm run probe:selected  # Verify the pinned model through the production guard
```

Both commands use the server-side API key and incur API charges. Raw probabilities, latency, cost, and resolved model are preserved in the probe artifacts. Before changing the model, criteria, or threshold, rerun these probes and add representative support traffic and adversarial cases. The validation/transport code in `src/decisions.ts` was copied from the OpenRouter Decisions skill and extended with HTTP cancellation and injectable fetch.
