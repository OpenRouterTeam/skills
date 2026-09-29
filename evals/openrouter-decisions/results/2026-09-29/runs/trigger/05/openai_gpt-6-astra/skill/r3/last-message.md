Based on your descriptions—the files weren’t available locally:

- **triage.ts — candidate.** Ticket routing requires understanding intent; keywords miss paraphrases and context. A decision model could choose a destination, with ambiguous cases deferred.
- **dedupe.ts — candidate.** Token overlap measures shared wording, not whether tickets describe the same underlying issue. A decision model could assess duplicate likelihood for retrieved open tickets; code would apply the flagging threshold.
- **approvals.ts — conditional candidate.** Routine refund judgments could be automated where policy permits. Keep amount comparisons in code and retain human review for uncertain cases. If human approval above $50 is mandatory policy, the model must not bypass it.

**Not candidates:** `tax.ts` is a deterministic VAT lookup; `auth/permissions.ts` is an explicit authorization mapping. Both belong in code.