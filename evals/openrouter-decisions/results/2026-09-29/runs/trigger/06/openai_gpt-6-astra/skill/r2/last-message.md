Use a two-stage gate: **code checks eligibility; a decision model handles any remaining judgment.** Keep the human queue as the fallback.

1. **Enforce the hard rules in code using authoritative records:**
   - Purchase is within 90 days.
   - Requested amount is at or below the order total.
   - Customer has fewer than two refunds in the applicable year, so this refund would be their first or second.

   Define whether “year” means calendar year or rolling 12 months. Missing records go to review; clear rule failures follow your existing ineligible-request process without calling a model.

2. **Check whether judgment is actually needed.** If those three rules fully determine approval, automatically approve eligible requests directly. A model adds value only if reviewers also assess something subjective, such as whether the refund reason qualifies under a written policy.

3. **For that remaining judgment, use OpenRouter’s Decisions API.** For example, a `noul` question could ask: “Does this refund reason qualify under the refund-reason policy?” Send the relevant policy, customer explanation, and supporting evidence. Keep date calculations, dollar comparisons, and refund counts in code.

4. **Auto-approve only above a validated threshold; send everything else to humans.** Choose the threshold using representative historical cases and a held-out evaluation, including ambiguous requests and attempts to manipulate the model. The 95% approval rate suggests opportunity, but doesn’t establish model accuracy. Measure incorrect approvals and dollars exposed alongside queue reduction. API failures also fall back to review.

5. **Roll out in shadow mode first**, comparing proposed approvals with reviewers. Then enable gradually, audit samples, and log decisions. At execution, recheck eligibility and atomically reserve the customer’s refund allowance; use idempotency to prevent duplicate payouts.

The key missing policy detail is what, beyond those three hard rules, makes an eligible request ambiguous.