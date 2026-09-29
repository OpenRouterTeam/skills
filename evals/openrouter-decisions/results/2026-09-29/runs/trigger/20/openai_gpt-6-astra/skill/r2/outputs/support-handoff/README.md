# Support handoff replacement

Standalone TypeScript integration prepared because this workspace contains no support bot or reviewed escalation data. Nothing is connected to production. The sample capabilities, help content, and policies are synthetic; replace them with the application's actual context.

`handoff.ts` replaces the chat completion plus `includes('yes')` with one OpenRouter Decisions `noul`: the probability that the unresolved request requires a human. Conversation context, relevant help, available bot capabilities, and handoff policy inform this judgment. Routine questions, frustration, and missing details alone do not warrant handoff. `continue` means run the existing bot workflow, which may answer, clarify, or explain its scope; it does not certify an answer's correctness.

Trusted mandatory rules bypass the model. Empty conversations stay with the bot. The server-side client validates typed answers, checks probability bounds and the returned model build, and preserves human handoff on missing credentials, malformed responses, provider failure, or a 10-second timeout. Logs contain the resolved build, raw probability, threshold, action, and reason without customer text. Keep existing policy checks in application code and supply their outcome through `mandatoryHandoff`; never populate it from an untrusted customer field. Rules involving amounts, retry counts, dates, permissions, or existing workflow flags belong there.

## Integrate

Requires Node.js 22+ and a server-side `OPENROUTER_API_KEY`.

```sh
npm ci
node --import tsx --test handoff.test.ts
node --import tsx probe.ts
```

At the bot's existing handoff call site:

```ts
import { decideHandoff } from './support-handoff/handoff.ts';

const decision = await decideHandoff({
  conversation: relevantConversation,
  relevant_help: retrievedHelpById,
  bot_capabilities: actualAvailableCapabilities,
  handoff_policy: currentHandoffPolicy,
}, {
  mandatoryHandoff: existingMandatoryPolicyResult,
  log: entry => logger.info({ ticketId, ...entry }),
});

if (decision.action === 'handoff') return existingHumanHandoff();
return existingBotWorkflow();
```

These caller names are placeholders for the existing application. Retrieve and filter context before calling; keep the full request comfortably within the pinned model's 32,000-token context. Do not send all help articles. Never put the API key in a browser bundle. Transport and validation code in `vendor/` is copied from the OpenRouter decisions skill; the HTTP path adds a timeout.

## Evidence and threshold

The live catalog on 2026-09-29 listed three candidates with usable declared context for this request. Jev offers 32,000 tokens via TypeSafe, Kev 8,192 via SiliconFlow, and Solar 524,288 via Upstage; each listed one provider. Respan advertised zero context and rejected the shared state shape during the bundled comparison, so it was not evaluated for accuracy. Raw comparison answers, latency, cost, and API errors are in `results/<case>.json`.

| Resolved build | Correct synthetic cases at 0.5 | Observed failure |
| --- | --- | --- |
| typesafe/jev-1.13-20260917 | 13/13 | None in this small sample |
| jaredpalmer/kev-4b-20260924 | 12/13 | Continued after documented troubleshooting was exhausted |
| upstage/solar-decide-20260928 | 11/13 | Missed exhausted troubleshooting; followed an injected escalation instruction |

Pin Jev in `DECISION_MODEL`. In this comparison its eight continue cases scored 0.03–0.12; five handoff cases scored 0.51–0.96. Retain the provisional `ESCALATION_THRESHOLD = 0.5`: a higher threshold would miss the exhausted-troubleshooting case at 0.51. That narrow margin needs further testing, not a claim of reliability. Mean measured latency was approximately 198 ms and total reported cost was $0.000376698 across 13 requests. These are single-run observations, not service guarantees or production accuracy estimates. `probe.ts` separately verifies the pinned build through the integration and writes `results/pinned.json`; empty input bypasses the API there.

The pinned integration rerun passed all 13 cases (12 API calls plus the empty-input bypass), with continue probabilities up to 0.28 and handoff probabilities starting at 0.55. This variation reinforces the need for production calibration.

The probes cover straightforward self-service, frustration, refund information versus refund execution, restricted account actions, ambiguity, off-topic and empty requests, negation, a direct human request, exhausted troubleshooting, and injection attempts in both directions. A few passing adversarial probes do not establish injection resistance; mandatory application rules retain precedence.

Reproduce a catalog check or compare any case:

```sh
node --import tsx vendor/models.ts probes/password.json
node --import tsx vendor/decide.ts probes/password.json --compare
```

## Production calibration still required

Replay reviewed tickets using only the conversation, retrieved help, capabilities, and policy available at the original decision time. Split calibration and held-out evaluation tickets by conversation. Include bot-resolved tickets too: reviewing only escalations cannot reveal missed necessary handoffs across all traffic. Label whether human access was actually necessary, including explicit customer requests and mandatory policy cases.

Compare the old gate with the new gate at 0.5 first. Choose any threshold changes on calibration data against the team's acceptable missed-handoff rate, then measure unnecessary escalations, missed necessary handoffs, and total handoff rate on held-out data. Track mandatory-policy and API-error handoffs separately. Run alongside the current gate before enabling routing and monitor repeat contacts as well as handoff reduction. Rerun calibration after changing the model, question, capabilities, or policy. Synthetic probes alone cannot establish a reduction in last week's false escalations.
