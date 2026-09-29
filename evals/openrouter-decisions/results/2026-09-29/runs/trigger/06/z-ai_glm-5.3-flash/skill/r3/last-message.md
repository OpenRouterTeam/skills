## Approach

**1. Keep the hard rules in code — never in the model.**

- `days_since_purchase <= 90`
- `refund_amount <= order_total`
- `refunds_in_last_365_days < 2`

These are deterministic lookups/comparisons. Compute them from your systems of record (orders DB, refunds ledger), and reject/route on violation without ever asking a model. Parse misses (bad order ID, unparseable date) become their own "needs review" outcome, not an auto-fail.

**2. Use a decision model only for the judgment code can't make.**

The single judgment is: *"Given this refund reason, customer message, and order context, is this a clear-cut approval, a clear-cut denial reason, or genuinely ambiguous?"* One `choice` primitive with options like:

- `obvious_approve` — routine reason, story matches the order data, no red flags
- `has_deny_reason` — refund policy excludes this item/situation, or the reason itself is a denial
- `ambiguous` — can't tell, or the story and order facts conflict

Send only what that judgment reads: the customer's stated reason/message, the item category/description, and the reason code the agent picked. Don't send computed booleans or counts — code already owns those.

**3. Gate in code with three bands, not two.**

| Model answer | Action |
|---|---|
| `obvious_approve` with high probability | Auto-approve |
| `has_deny_reason` with high probability | Route to "auto-deny candidate" (sample for audit, don't silently deny at first) |
| `ambiguous` **or** low confidence on either | Human queue — same as today |

Start conservative: a tight auto-approve band (e.g., P(obvious_approve) ≥ 0.95) and everything else to humans. Widen only after the probe data earns it. You already have a great baseline to beat: 95% of the current queue is approved, so your target is to auto-approve that same 95% with no worse error rate, and shrink human load to the residual 5%.

**4. Probe before you trust the thresholds.**

Run your real question over representative historical refunds: clear approvals, denied ones, refund-abuse patterns (serial partial refunds, "item not received" on delivered orders), empty/garbage messages, and adversarial text that argues its own case. Set the auto-approve and auto-deny thresholds from observed probabilities, not defaults.

**5. Sample and monitor.**

- Log model, probabilities, and outcome on every decision.
- Spot-check a sample of auto-approved cases against what humans would have said.
- Track false-approval rate (money lost on refunds a human would deny) as the primary metric, human-queue volume as the secondary one.
- Keep the "auto-deny candidate" path human-reviewed until its precision is proven.

**6. What this buys you.**

Roughly 95% of your queue becomes zero-touch, humans only see genuinely ambiguous cases, and every auto-approval carries an audit trail with the model's reasoning probabilities attached.