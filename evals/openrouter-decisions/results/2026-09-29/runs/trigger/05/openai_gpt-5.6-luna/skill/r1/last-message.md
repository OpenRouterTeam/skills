The requested files aren’t present in the workspace, so these candidates are based on your descriptions:

- `triage.ts` — keyword-based ticket routing. Use a `choice` decision for the ticket category; keywords miss paraphrases, context, and ambiguous requests.

- `dedupe.ts` — token-overlap duplicate detection. Use a duplicate/not-duplicate judgment (`noul`), since lexical overlap can miss semantic duplicates and flag unrelated tickets with shared boilerplate.

- `approvals.ts` — blanket human review for refunds over $50. Use a model to assess refund legitimacy or risk, with uncertain/high-risk cases still escalated. The $50 threshold itself should remain deterministic.

Not candidates:

- `tax.ts` — VAT-by-country lookup is deterministic policy data; keep it as code/configuration unless the input requires interpreting unstructured tax rules.

- `auth/permissions.ts` — role-to-scope mapping is an explicit authorization policy and should remain deterministic. A probabilistic model would make access control less predictable and auditable.