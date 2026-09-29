The prompt itself is the bottleneck: “should this be escalated?” invites the model to defer whenever anything looks risky, and matching on the literal string `'yes'` throws away how confident it was. The fix is to replace the yes/no chat call with a Decisions API `noul` question that asks a specific, answerable fact — and to gate on probability in code.

**Concrete replacement**

```json
{
  "model": "<pinned decision model slug>",
  "state": {
    "conversation": "<last N messages, verbatim>",
    "available_answers": "<what the bot is actually configured to answer>"
  },
  "questions": {
    "bot_can_answer": {
      "type": "noul",
      "instructions": "Can the support bot answer this correctly using only its configured product knowledge, without needing account-specific data or an action it cannot take?",
      "criteria": {
        "true": "It is a general product, policy, pricing, or how-to question the bot’s knowledge covers.",
        "false": "It needs account access, a refund or status change, personal data, a commitment, or the answer is not in the bot’s knowledge."
      }
    }
  }
}
```

Then gate in code, not on string match:

```ts
const ESCALATE_THRESHOLD = 0.5; // probe before tightening
const answerable = response.answers.bot_can_answer;
if (answerable.type !== "noul") throw new Error("unexpected answer type");
if (answerable.noul >= ESCALATE_THRESHOLD) {
  // bot answers
} else {
  // human handoff
}
```

**Why this reduces the false handoffs:**

- Asking “can the bot answer this” is a property of the situation; “should it be escalated?” is a policy judgment models default to “yes” on.
- `noul` returns `P(yes)`, so instead of a binary string match you can set a threshold from real cases — e.g. 0.5 to start, raised toward 0.7–0.8 only after probing.
- Naming the exclusions explicitly (account data, refunds, commitments, unknown topics) gives the model a real rubric instead of a vague “should.”
- Anything near the threshold still escalates, which is the right default for a support bot.

**To finish this properly, I need the actual handoff code.** I couldn’t find it in this workspace — `rg --files` returned nothing besides skill metadata. If you point me at the repo (or paste the function that builds the handoff prompt), I can make the change directly and wire up the threshold probe against your last week’s escalations.