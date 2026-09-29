Use a **hard-rule gate followed by a judgment gate**, with human review as the fallback.

1. **Enforce the hard rules in code using trusted records.** Purchase age ≤90 days; requested amount ≤order total; fewer than two prior refunds in the applicable year, so this refund would be at most the second. Define whether “year” means calendar year or rolling 12 months. Failed rules block auto-approval; missing records go to review.

2. **Identify what still needs judgment.** If those three rules fully determine eligibility, approve eligible requests directly—no model needed. If reviewers also interpret refund reasons or supporting evidence, document that rubric using previously reviewed cases.

3. **Score that remaining judgment.** Use OpenRouter’s Decisions API with a `noul` question such as “Does this request qualify under the refund-reason policy?” Supply the rubric, customer explanation, and relevant evidence. Keep date arithmetic, amounts, and refund counts in code.

4. **Approve only above a validated threshold.** High probability → auto-approve. Everything else—including ambiguous cases, API failures, and malformed responses—→ human review. A low score should not automatically deny a refund.

5. **Validate before enabling payments.** Run in shadow mode on representative requests, including historical denials, ambiguous cases, and attempts to manipulate the model. Choose the threshold based on incorrect approvals and their dollar cost. The current 95% approval rate is a baseline, not a confidence threshold or proof of accuracy.

At execution, recheck eligibility atomically and make payments idempotent so concurrent requests cannot bypass the refund limit. Log decisions and model versions, audit a sample of auto-approvals, and retain a switch that sends everything back to review.