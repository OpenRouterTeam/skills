**Candidates**

- **`triage.ts` — keyword router for tickets.** Mapping free-text complaints to a bounded set of categories/queues is a judgment call that keywords do poorly (synonyms, negation, sarcasm, multi-topic tickets). A `choice`-type decision ("which queue does this belong to?") over the ticket text would classify more reliably, and low-confidence cases could fall back to your existing human queue instead of being misrouted silently.

- **`dedupe.ts` — token-overlap duplicate flag.** Token overlap ≥ 0.6 is a crude proxy for "is this the same underlying issue?" Two tickets about the same outage share almost no tokens; two unrelated tickets about the same product can look near-identical. The real question — "is this a duplicate of the open ticket?" — is a `noul` judgment over both tickets' content; the 0.6 threshold comparison itself stays in code.

- **`approvals.ts` — refunds over $50 wait for a human.** Every approval above the cap goes to review regardless of risk, so humans spend most time confirming obvious low-risk refunds. A `noul` ("does this refund warrant escalation?") judged on refund reason, order context, and customer history would let clear-cut cases pass, with the human queue remaining as the fallback band near the threshold. The $50 amount itself stays as a code-side rule, not a model question.

- **`auth/permissions.ts` — role→scope mapping** is a **non-candidate**. It's a static lookup of a fact code already holds (role → allowed scopes); there's no judgment to make, so a model would add cost and risk for zero gain. Keep it as a table.

- **`tax.ts` — VAT by country table** is also a **non-candidate**. VAT rate is a deterministic fact stored in the table, not a judgment; code should just read it. (Worth noting: if you ever needed to classify a purchase as B2B/B2C or detect a customer's real jurisdiction from messy free-text address input, *that* would be a decision-model candidate — but the table lookup itself is not.)