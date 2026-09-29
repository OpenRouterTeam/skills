Plan:

1. Change `route` to an async function returning `Promise<"billing" | "engineering" | "support">`, since it will call OpenRouter.

2. Replace keyword matching with one Decisions API `choice` question:

   - `billing`: invoices, charges, payments, refunds, or subscription billing.
   - `engineering`: crashes, errors, bugs, broken product behavior, or technical failures.
   - `support`: product questions, usage help, account assistance, or issues that do not fit the other categories.
   - `none`: insufficient, unrelated, or genuinely ambiguous information.

3. Send only the ticket text in named state, such as ``ticket.text``. The question will classify what the ticket is about, rather than asking whether it contains particular keywords, so negation and paraphrases are handled semantically.

4. Query the live OpenRouter decisions catalog, select a suitable decision model, and pin its `canonical_slug` rather than using an alias. The selected model and usage metadata should be logged.

5. Map the returned `choice` to the existing public labels. Return `support` for `support` or `none`, preserving the current fallback behavior. Treat missing or unexpected response types as errors rather than silently routing them.

6. Add named code-side behavior for API failures and low-confidence/ambiguous cases. The exact confidence policy and any threshold will be determined from representative probes, not chosen in advance.

7. Probe the candidate model with clear billing, engineering, and support examples, plus ambiguous, empty, negated, off-topic, and adversarial tickets. Use those results to validate the criteria, fallback behavior, latency, and cost.

No code or files will be changed in this step.