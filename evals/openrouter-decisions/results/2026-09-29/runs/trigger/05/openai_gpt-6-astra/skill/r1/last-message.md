Based on your descriptions—the files weren’t present in the workspace:

- **`triage.ts` — strong candidate.** Ticket routing needs interpretation of intent; keywords miss paraphrases and context. A decision model could choose a queue, with uncertain cases sent for review.
- **`dedupe.ts` — strong candidate.** Token overlap above 0.6 measures shared wording, not whether tickets describe the same issue. A decision model could assess candidate pairs for semantic duplication; code would retain candidate retrieval and flagging thresholds.
- **`approvals.ts` — conditional candidate.** If the $50 cutoff is a rough proxy for cases needing judgment, a model could assess refund justification and defer uncertain cases to humans. If human approval above $50 is mandatory policy, preserve that gate; amount comparisons stay in code.

**Not candidates:** `tax.ts` is a deterministic VAT lookup; `auth/permissions.ts` implements explicit access policy. Both belong in code.