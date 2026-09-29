Use a two-stage approval gate:

1. Deterministic policy checks in application code

For each request, compute:

- Purchase age ≤ 90 days
- Refund amount ≤ order total
- Customer’s annual refund count < 2
- Request amount > $50, if this workflow only targets larger refunds

If any hard rule fails, route to the appropriate existing outcome—usually reject or human review. Do not ask the model to judge arithmetic, dates, or counts.

2. Decision model for the remaining requests

Send only relevant context, such as:

- Customer’s refund reason
- Order/product details
- Prior refund summaries
- Payment and fulfillment status
- Supporting messages or evidence
- Applicable refund policy text

Ask a bounded `noul` question:

> Is this a routine, well-supported refund request with no apparent exception, fraud signal, or policy ambiguity?

The model returns a probability, not prose. Gate it in code:

```text
if hard_rules_fail:
    human_review_or_reject()
else if P(routine_request) >= AUTO_APPROVE_THRESHOLD:
    auto_approve()
else:
    human_review()
```

Start conservatively—for example, auto-approve only at a very high probability—and determine the threshold from historical labeled requests. Since 95% are approved, use past human decisions as an initial evaluation set, but separately measure false approvals and missed obvious approvals.

Before enabling it:

- Run in shadow mode against the existing queue.
- Probe clear, ambiguous, adversarial, unsupported, and edge cases.
- Compare model decisions with human outcomes.
- Log inputs, hard-rule results, model/version, probability, threshold, and final action.
- Keep a manual override and immediate rollback path.
- Monitor approval rate, escalation rate, false-approval rate, complaints, chargebacks, and per-customer abuse.

Pin a specific Decisions model version and keep thresholds/configuration outside the prompt so policy remains auditable and changeable.