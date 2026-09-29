The fix is to replace the keyword map with a probabilistic intent classifier, while keeping deterministic safeguards and a review fallback.

Plan:

1. Define the routing taxonomy clearly:
   - `billing`: duplicate charges, refunds, invoices, payment failures, subscriptions
   - `engineering`: crashes, bugs, errors, outages
   - `support`: account or product questions
   - optionally `fraud_or_security`: unauthorized transactions or suspected compromise
   - `needs_review`: ambiguous or low-confidence cases

2. Use a Decisions API `choice` question for the primary intent. Provide the ticket’s subject, message text, and relevant conversation context as structured state. The criteria should describe meanings, not keywords—for example, “The customer says they were charged more than once” belongs to billing.

3. Keep code-owned rules for hard cases:
   - Explicit fraud/security language can route to the security or urgent billing workflow.
   - Known structured fields should override model judgment.
   - Do not send unnecessary account or payment details to the model.

4. Gate the result in code:
   - Accept the selected queue only when its probability and confidence meet calibrated thresholds.
   - Otherwise send the ticket to `needs_review` or general support.
   - Preserve the raw probabilities and resolved model version for auditing.

5. Build a representative evaluation set from historical tickets:
   - Clear billing examples, including “you took money from me twice”
   - Clear engineering and support examples
   - Ambiguous, negated, short, multilingual, and adversarial messages
   - Cases involving fraud or high financial risk

6. Probe candidate decision models on that set, compare accuracy, latency, cost, and failure rates, then pin the selected model version. Set thresholds from observed results rather than defaults.

7. Roll out gradually:
   - Shadow classification beside the existing router
   - Compare predicted routes with human outcomes
   - Route only high-confidence decisions initially
   - Monitor misroutes and expand the evaluation set
   - Retire keyword routing once the new classifier is demonstrably better

The specific ticket should classify as billing because its meaning is a duplicate charge, even though it contains none of the current keywords.