# Support-agent injection guardrail

Server-side TypeScript wrapper for string messages. One OpenRouter Decisions API
`noul` question returns the probability of a prompt-injection attempt. It does not
request generated text or parse a chat completion.

This workspace had no existing support agent. Connect its entry point through
the wrapper below, so the check finishes before the agent starts its tool loop:

```ts
import { runGuardedSupportAgent } from "./src/guardrail.js";

// supportAgent is your existing agent, with its existing tool authorization.
const result = await runGuardedSupportAgent(userMessage, async (message) => {
  return supportAgent.run(message);
});

if (result.guardrail.action === "allow") {
  // Return result.output to the customer.
} else {
  // Return a static response or use your existing human-support path.
  // Do not invoke the agent or refund tools on this branch.
}
```

Use `checkMessage(message)` for the check alone. A successful check returns
`{ action, probability, model, latencyMs }`. The probability is P(injection),
between 0 and 1; `>= 0.5` blocks. Errors return `unavailable` with `probability:
null`, never a fabricated probability. Empty/non-string messages and messages over
4,096 UTF-8 bytes return `invalid_input` without a model call. Oversized text is
rejected intact rather than truncated. The wrapper passes the exact checked
string to the agent.

Set `OPENROUTER_API_KEY` in the server environment. Never ship the key or this
client to a browser. Run with Node.js 24:

```sh
npm ci
npm run typecheck
npm test
npm run probe
```

The HTTP path has no runtime package dependencies, makes one request, and uses a
1,500 ms deadline with no retries. Timeout, HTTP failure, invalid JSON, missing
answers, invalid probabilities, or an unexpected model build stop execution.
The default logger records action, probability, resolved model and latency without
message text; supply `log` to use your application's logger. A caller must not
fall back to unguarded execution if this function fails.

## Model and probe evidence

The live Decisions catalog was checked on 2026-09-29. Solar Decide, Kev 4B and Jev
1.13 had adequate advertised context for this bounded input. Respan entries
advertised zero context, so were excluded pending a verified input limit. Aliases
were excluded. Endpoint listings showed one distinct provider per shortlisted
model; none offered independent provider redundancy.

The 12 synthetic probes per model cover normal refunds, complaints, direct
overrides, role spoofing, secret extraction, classifier manipulation, negation,
quoted attack reports, an ambiguous bypass request, off-topic text, empty input,
and role play. Raw probabilities, latency, token usage and cost are saved in
[probe-results.json](probe-results.json). Empty text is probed to characterize
the model; the application rejects it before classification.

Jev `typesafe/jev-1.13-20260917` passed all 11 cases with definite labels. Its
benign probabilities ranged from 0.01 to 0.13; clear attacks were 0.98–0.99.
The ambiguous request to skip normal steps scored 0.74 and is blocked. These
observations support retaining the initial 0.5 gate. Solar misclassified the
quoted attack report (0.630206); Kev scored the classifier-manipulation attack
close to the gate (0.503). Jev also had the lowest observed latency, 101–199 ms
across this small sample. These are measurements from one run, not a latency SLA
or proof of calibration on customer traffic. Re-run and expand the probes with
representative labeled messages before production, and after changing the
question, threshold, or pinned model.

## Refund boundary

The classifier itself sees adversarial text and can be fooled. Passing the gate
allows the support conversation to proceed; it does not authorize a refund.
Keep account ownership, order eligibility, refund caps, duplicate prevention and
any required approval enforced inside the refund tool using trusted server data.
Use the existing review path when those checks cannot establish authorization.
The entry check covers the current message only; prior conversation, retrieved
documents and tool outputs remain separate untrusted inputs.

`src/decisions.ts` copies the skill's validated HTTP client and request/response
types, with abort support added and its unused SDK transport removed. Tests mock
HTTP to verify that rejected and failed checks never start the agent; live
classification evidence is recorded separately by the probe script.
