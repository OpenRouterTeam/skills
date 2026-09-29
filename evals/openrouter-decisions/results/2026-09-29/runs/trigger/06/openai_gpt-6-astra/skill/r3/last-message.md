Use **hard eligibility checks first, then a judgment gate only if something remains to judge**.

1. **Enforce the rules in code using trusted records.**
   - Purchase is within 90 days.
   - Requested amount is at or below the order total.
   - Customer has fewer than two prior refunds in the applicable year, so this refund stays within the limit.

   Define whether “year” means calendar year or rolling 12 months. Missing records go to review; known rule failures follow your ineligible-request process. A model cannot override these checks.

2. **Define what makes an eligible request “obvious.”** If those three rules fully determine approval, automatically approve every eligible request—no model needed. If humans also interpret refund reasons or supporting evidence, document that rubric.

3. **Use a decision model for that remaining judgment.** Through OpenRouter’s Decisions API, use a `noul` question such as: “Does this request’s reason qualify under the refund-reason policy?” Supply the reason, relevant evidence, and written rubric. Keep date calculations, amounts, and refund counts in code.

4. **Route on the returned probability.**
   - Above a validated approval threshold → auto-approve.
   - Everything else, including API errors → human review.
   
   Low model probability should not automatically reject a request. Choose the threshold from reviewed examples and an acceptable mistaken-approval rate; the historical 95% approval rate alone does not establish a safe cutoff.

5. **Launch in shadow mode, then expand.** Compare proposed approvals with human decisions, including ambiguous cases and customer text trying to influence approval. Track mistaken approvals, dollars incorrectly refunded, and queue reduction; audit a sample after launch.

Immediately before issuing payment, atomically recheck eligibility and reserve the refund allowance, with duplicate-payment protection. That prevents simultaneous requests from slipping past the two-refund limit.