I’d replace the keyword map with a hybrid router:

1. Define the routing taxonomy

Use one primary-owner `choice`:

- `billing`: charges, duplicate charges, refunds, invoices, subscriptions, payment methods, unauthorized payments
- `engineering`: crashes, errors, broken behavior, failed workflows
- `support`: how-to questions, account questions, general requests
- `review`: ambiguous or conflicting cases

Keep secondary tags separately if tickets can span teams—for example, “payment page crashes” could be owned by billing but tagged engineering.

2. Preserve deterministic rules

Keep high-precision rules in code for known signals such as internal ticket fields, product area, or explicit escalation markers. Do not rely on expanding keyword lists for natural-language intent.

3. Add a Decisions API classification step

Send only the relevant ticket subject and message text. Ask a single bounded choice question whose criteria explicitly include semantic examples:

- “You took money from me twice” → billing
- “I cannot get the checkout page to load; it crashes” → engineering
- “How do I change my password?” → support
- “I was charged, but the app also fails during checkout” → whichever ownership policy you define

The model should judge what the customer needs, not whether a literal keyword appears.

4. Route based on calibrated probabilities

Auto-route only when the selected team has sufficient probability and is clearly ahead of alternatives. Send low-confidence or closely competing cases to `review` or a human triage queue.

The exact thresholds should come from a probe set, not defaults. Billing mistakes may have financial consequences, so use a stricter threshold for billing than for ordinary support routing.

5. Build and test a representative probe set

Include:

- Clear billing cases: duplicate charge, refund request, unexpected renewal, invoice question
- Clear engineering cases: crash, error message, broken feature
- Clear support cases
- Ambiguous billing/engineering cases
- Negated cases: “I was not charged twice”
- Empty, off-topic, and multilingual cases if relevant
- Adversarial text that tries to influence classification

Measure billing recall especially, while tracking false billing escalations and human-review rate.

6. Roll out safely

First run the classifier in shadow mode while the keyword router remains authoritative. Compare predictions with historical labels and human triage. Then canary it for a small percentage of tickets, logging:

- Original ticket text or a privacy-safe identifier
- Chosen route and probabilities
- Model version
- Final human-corrected route
- Latency and cost

Use those corrections to improve the criteria and probe set.

The key fix for “you took money from me twice” is defining billing around the customer’s underlying intent—charges, payments, refunds, and subscriptions—then using a probability-based semantic choice with a review fallback, rather than treating billing as a list of literal words.