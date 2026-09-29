- `triage.ts` — Keyword-based ticket routing. A decision model could classify intent and route among queues, handling synonyms, negation, and multi-intent tickets; probabilities could support escalation when uncertain.

- `dedupe.ts` — Token-overlap duplicate detection. Semantic similarity would better identify paraphrased duplicates and avoid false positives from shared generic terms. Keep retrieval and thresholding deterministic; use the model for duplicate judgment.

- `approvals.ts` — Refund review triggered solely by amount. The `$50` policy gate is deterministic, but refund legitimacy, fraud risk, and exceptions are judgment work suitable for approve/deny/escalate decisions, reducing unnecessary human review.

- `tax.ts` — The country-to-VAT table itself is not a candidate; it is an authoritative deterministic lookup. Only tax applicability or jurisdiction inferred from ambiguous transaction details would be a decision-model candidate.

- `auth/permissions.ts` — Role-to-scope mapping is not a suitable model candidate. Authorization should remain deterministic and policy-controlled. Only upstream interpretation of ambiguous, unstructured entitlement requests might warrant classification; the final permission check should not.