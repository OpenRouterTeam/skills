The specified service files aren’t present in the workspace, so this is based on the descriptions provided.

Candidates:

- `triage.ts` — Keyword-based ticket routing. A `choice` decision model could classify intent from the full ticket context, handling synonyms, ambiguity, and multi-word meaning better than keyword matches.

- `dedupe.ts` — Fixed token-overlap threshold. A decision model could judge whether two tickets describe the same underlying issue, while code retains candidate retrieval and the final threshold/escalation logic.

- `approvals.ts` — Human review for every refund over $50. A model could assess refund legitimacy or risk and automatically approve clearly safe cases, reserving human review for ambiguous or high-risk cases. The $50 policy threshold itself should remain deterministic.

Not strong candidates:

- `tax.ts` — A country-to-VAT table is a deterministic policy lookup; replacing it with a probabilistic judgment could reduce correctness and auditability.

- `auth/permissions.ts` — Role-to-scope mapping is an explicit authorization policy and should remain deterministic. A model should not decide access rights.