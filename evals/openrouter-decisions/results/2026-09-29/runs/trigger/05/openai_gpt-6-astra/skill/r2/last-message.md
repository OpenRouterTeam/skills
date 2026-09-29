Based on your descriptions—the files weren’t present in the workspace:

- **`triage.ts` — candidate.** Ticket routing requires understanding intent; keywords miss paraphrases and misroute incidental mentions. A decision model could choose a queue, with ambiguous cases deferred.
- **`dedupe.ts` — candidate.** Token overlap above 0.6 doesn’t establish that tickets describe the same issue. Semantic duplicate judgment could catch differently worded duplicates and distinguish similar wording about separate problems. Keep candidate retrieval in code.
- **`approvals.ts` — conditional candidate.** If humans assess refund justification, a decision model could handle clear cases and escalate uncertain ones. Keep amount comparisons and mandatory approval rules in code; if human approval over $50 is a hard policy, preserve it.

**Not candidates:** `tax.ts` is a deterministic VAT lookup; `auth/permissions.ts` is an explicit authorization mapping. Both belong in code.