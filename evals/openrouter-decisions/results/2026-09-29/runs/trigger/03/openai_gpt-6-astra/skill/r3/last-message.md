I’d replace the keyword map with a **semantic classifier that chooses the team responsible for the customer’s problem**. Adding synonyms would patch this example but keep missing new phrasing.

My proposed plan:

1. **Define the routing policy.** Assuming each ticket needs one primary owner:
   - **Billing:** payments, duplicate charges, refunds, invoices, and subscription pricing.
   - **Engineering:** crashes, broken functionality, and technical failures.
   - **Support:** product usage and other general assistance.
   - **Needs triage:** unclear, unrelated, or mixed requests without a clear owner.

   “You took money from me twice” should route to billing. “The invoice page crashes” should route to engineering because the requested help concerns broken functionality.

2. **Use a bounded decision model.** OpenRouter’s Decisions API fits this: one `choice` question selects among those four outcomes and returns probabilities. Supply the ticket subject, body, and relevant conversation context. Ask which team should resolve the request, with explicit inclusion and exclusion rules for each team.

3. **Keep routing policy in code.** Honor explicit manual assignments and handle empty tickets directly. Use the model’s choice for automatic routing, with uncertain cases going to triage. Select uncertainty thresholds from evaluation results; model confidence alone is not proof of correctness. API failures should enter a visible fallback queue instead of silently becoming support tickets.

4. **Evaluate against real tickets.** Build a human-labeled sample covering paraphrases, mixed issues, negation (“I wasn’t charged twice”), irrelevant text, and instructions embedded in tickets that try to influence routing. Compare available decision models and the existing router. Prioritize **billing recall**—how many genuine billing tickets reach billing—while tracking incorrect billing assignments, overall accuracy, triage volume, latency, and cost.

5. **Roll out gradually.** First run alongside the existing router without changing assignments. Review disagreements, tune the policy and thresholds, then enable a small share of traffic. Pin the tested model version and monitor agent reassignments for regressions.

The key change is making support an intentional classification, rather than the destination for everything the router fails to understand.