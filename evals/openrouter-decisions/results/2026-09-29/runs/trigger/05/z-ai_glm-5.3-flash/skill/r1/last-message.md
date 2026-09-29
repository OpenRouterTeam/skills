I found the service files aren’t present in the workspace, so I’ll audit based on the behavior you described.

**Candidates**

- `triage.ts` — keyword ticket router: keyword matching is brittle judgment work (intent, urgency, and subjectivity depend on phrasing). Better suited to a semantic classifier or LLM-based categorization, with confidence thresholds and escalation to a human when uncertain.

- `dedupe.ts` — token-overlap > 0.6: overlap is a crude proxy for duplication. It ignores paraphrasing, synonyms, and semantic intent, and a fixed threshold likely produces both false positives and misses. A semantic similarity model (embedding distance or LLM judgment) would handle this better, ideally with a tuned threshold and human review for borderline cases.

- `approvals.ts` — every refund over $50 waits for a human: a flat dollar threshold is a blunt heuristic. Risk actually depends on customer history, refund reason, order type, fraud signals, and agent trust level — not just amount. A risk-scoring decision model or rules-plus-model hybrid (auto-approve low-risk, human-review medium/high) would be better.

- `tax.ts` — VAT-by-country table: this is actually **not** a judgment problem. Tax rates are deterministic, legally defined facts, so a lookup table is the correct design here — arguably better than a model, since a model could hallucinate a rate. The only improvement worth considering is sourcing the table from an authoritative/tax-vendor API and versioning it, not replacing it with judgment.

- `auth/permissions.ts` — role-to-scope mapping: also **not** judgment work. Authorization mapping is a correctness/security concern, not a classification task. This is exactly where you *don't* want a probabilistic model. The only refinement here is structural (least-privilege scopes, clearer role definitions), not a switch to model-based decisions.

**Summary**

| File | Judgment work? | Better approach |
|---|---|---|
| `triage.ts` | Yes | Semantic/LLM classifier with escalation |
| `dedupe.ts` | Yes | Embedding or LLM similarity, tuned threshold |
| `approvals.ts` | Yes | Risk-scored auto-approval/human hybrid |
| `tax.ts` | No | Lookup table is correct; consider a sourced API |
| `auth/permissions.ts` | No | Keep deterministic; refine role/scope design |