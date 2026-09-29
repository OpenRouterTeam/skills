Use a two-stage gate: deterministic policy first, Decisions API second.

1. Compute hard rules in application code:

```text
within_90_days = purchase_date >= now - 90 days
amount_valid = refund_amount <= order_total
annual_limit_ok = prior_refunds_this_calendar_year < 2
```

These facts should never be delegated to the model. If a rule fails, do not auto-approve. Route to the policy outcome—typically automatic denial with an appeal path, or human review if your policy requires it.

2. For requests that pass, ask a decision model only about judgment-based ambiguity, such as:

- Is this a routine, legitimate refund request?
- Is there evidence of abuse, fraud, or an exceptional pattern?
- Is the customer’s stated reason sufficiently clear and consistent with the order context?

Use independent `noul` questions rather than asking the model to calculate amounts, dates, or counts.

3. Gate the result in code:

```text
if any_hard_rule_fails:
    deny_or_review
else if legitimate_probability >= APPROVE_THRESHOLD
        and abuse_probability <= ABUSE_THRESHOLD:
    auto_approve
else:
    human_review
```

Start conservatively. Since approval errors may be more costly than unnecessary review, optimize for high precision on auto-approval, not maximum queue reduction. Set thresholds from a labeled sample of historical refunds, including clear approvals, ambiguous cases, denials, edge cases, and adversarial customer text.

The request state should contain only judgment-relevant fields: refund reason, order/item context, customer history signals, and relevant fraud indicators. Keep computed rule results and all enforcement logic in code. Log the pinned model version, raw probabilities, thresholds, final route, and eventual human decision so you can measure false approvals, review rate, and queue reduction.

A sensible rollout is shadow mode first, then a small percentage of auto-approvals, with automatic rollback if false approvals exceed the agreed safety threshold.