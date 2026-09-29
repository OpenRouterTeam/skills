No app files exist here, so I can’t make a direct patch. Here’s the tightened design:

**Core Change**
- Replace the chat-model `yes/no` prompt with a Decisions API `noul` question: `should_escalate`.
- Return a probability, then gate in code with a named threshold instead of substring matching.
- Send only handoff-relevant facts as named state: user question, bot answer, unresolved attempts, account/policy context, and channel constraints.
- Define the judgment explicitly: escalate only when the bot cannot safely complete the request, the request is outside policy, or an answer would require authority/access the bot lacks.

**Request**
```json
{
  "state": {
    "user_question": "...",
    "bot_answer": "...",
    "unresolved_attempts": "...",
    "policy_context": "..."
  },
  "questions": {
    "should_escalate": {
      "type": "noul",
      "instructions": "Can this support request be safely resolved without a human handoff?",
      "criteria": {
        "true": "The bot has enough information, authority, and policy clearance to resolve the request.",
        "false": "The request requires human authority, account action, access the bot lacks, or is outside supported policy."
      }
    }
  }
}
```

**Gate**
```ts
const AUTO_RESOLVE_THRESHOLD = 0.7; // false negatives cost human time; false positives risk unsafe automation.

const answer = response.answers.should_escalate;
if (answer.type !== "noul") throw new Error("Expected noul answer");

const shouldAutoResolve = answer.noul >= AUTO_RESOLVE_THRESHOLD;
if (!shouldAutoResolve) handoffToHuman();
```

**Important**
- Probe representative historical escalations before choosing `0.7`; tune using observed probabilities for clear self-service, clear handoff, ambiguous, adversarial, and empty cases.
- Pin a specific decision model `canonical_slug`, not an alias.
- Log the resolved model, probability, threshold, and outcome for later threshold review.
- For multi-label routing, use one `choice` rather than several yes/no checks.

If you can share the bot’s handoff code or a sample escalation log, I can implement and calibrate this directly.