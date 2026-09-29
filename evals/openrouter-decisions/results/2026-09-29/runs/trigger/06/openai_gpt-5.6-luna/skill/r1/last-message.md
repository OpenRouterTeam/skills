Use a two-stage gate:

1. Deterministic eligibility in application code

For each refund over $50:

```text
if purchase_age_days > 90:
    do not approve automatically
if refund_amount > order_total:
    do not approve automatically
if customer_refunds_in_last_year >= 2:
    do not approve automatically
```

These facts should come from trusted structured data, not the model. Depending on policy, failures can be auto-denied or sent to humans for review.

2. Decision model for residual ambiguity

For requests that pass the hard rules, send only the evidence needed to judge whether the case is obvious:

```json
{
  "state": {
    "refund_reason": "...",
    "customer_message": "...",
    "order_items": [...],
    "relevant_delivery_or_return_evidence": "...",
    "prior_refund_context": "..."
  },
  "questions": {
    "clearly_auto_approvable": {
      "type": "noul",
      "instructions": "Determine whether this refund is clearly eligible for automatic approval under the supplied policy and evidence. Answer yes only when the reason, order evidence, and requested amount are consistent, with no unresolved contradiction or exception signal. Do not reconsider the separately enforced age, amount, or annual-count rules.",
      "criteria": "yes if clearly approvable; no if evidence is missing, contradictory, exceptional, or ambiguous"
    }
  }
}
```

Then route using a calibrated probability threshold:

```text
if P(clearly_auto_approvable = yes) >= AUTO_APPROVE_THRESHOLD:
    auto-approve
else:
    human queue
```

Start in shadow mode, compare the model’s proposed approvals with historical human outcomes, and choose the threshold based on the cost of an incorrect approval versus unnecessary review. Given the 95% approval rate, optimize for high precision first, then gradually lower the threshold if audits show the risk is acceptable.

Operational safeguards:

- Log the raw probability, model version, inputs, and final route.
- Send model/API failures to humans.
- Keep a random sample of auto-approvals for audit.
- Test clear cases, ambiguous cases, missing evidence, contradictory evidence, negated claims, and customer text that attempts to influence the classifier.
- Pin a specific decision-model version and periodically recalibrate the threshold.

The model should judge only “is this clearly approvable?”; code should own arithmetic, dates, counts, policy gates, thresholds, and the final approval action.