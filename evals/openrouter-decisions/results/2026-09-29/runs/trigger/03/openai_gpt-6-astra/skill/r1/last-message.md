I’d replace the keyword map with **semantic classification plus an uncertainty fallback**. “You took money from me twice” expresses a billing problem even though it contains neither keyword. Adding synonyms would patch individual misses but leave the underlying problem.

1. **Define the routing policy.** Choose one primary destination:
   - **Billing:** payments, duplicate charges, refunds, invoices, subscription charges.
   - **Engineering:** crashes, broken functionality, technical failures.
   - **Support:** account help, how-to questions, other general assistance.
   - **Needs triage:** unclear, unrelated, or mixed requests without an obvious primary issue.

   Explicitly resolve overlap: “charged twice” goes to billing; “the payment page crashes before I can pay” goes to engineering.

2. **Use a bounded decision model.** Send the ticket subject and relevant message text to OpenRouter’s Decisions API using one `choice` question: which team should own resolving this request? It returns a destination and probabilities across the options. Keep hard business rules and queue assignment in application code.

3. **Evaluate before selecting a model or thresholds.** Build a labeled sample of historical tickets, including missed billing requests. Test paraphrases, mixed issues, empty inputs, negation such as “I wasn’t charged twice; the app crashes,” and text that tries to dictate its classification. Compare currently available decision models on accuracy, latency, and cost.

4. **Handle uncertainty explicitly.** Tune the triage threshold using those results and the cost of wrong assignments. Send uncertain decisions and API failures to triage instead of silently treating them as general support. Model confidence is a signal to validate, not a guarantee.

5. **Roll out in shadow mode, then gradually.** Compare proposed routes with human-confirmed destinations before changing assignments. Track billing recall, billing precision, overall misrouting, triage volume, and latency. Pin the evaluated model version and retain a rollback switch.

The acceptance test is fewer billing tickets reaching support **without flooding billing with unrelated requests**. Your “took money from me twice” example should become a permanent regression case.