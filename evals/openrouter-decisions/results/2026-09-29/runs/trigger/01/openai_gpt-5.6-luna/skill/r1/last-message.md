Plan only—no code changes made.

1. Replace the keyword `if` chain with one OpenRouter Decisions API `choice` question.

   Options:

   - `billing`: invoices, charges, payments, refunds, or subscription billing.
   - `engineering`: software defects, crashes, errors, failures, or broken product behavior.
   - `support`: general usage questions or issues that do not fit the other categories.
   - `none`: insufficient or unrelated information.

2. Send only the ticket text in named state:

   ```json
   { "ticket_text": "<text>" }
   ```

   The question should classify the ticket’s actual intent, not merely detect whether certain words appear, so negation and synonyms are handled correctly.

3. Preserve the existing function contract:

   - Return the model’s `billing`, `engineering`, or `support` choice.
   - Map `none` to `support`, unless the product wants a separate escalation/review path.
   - Treat malformed responses, API failures, and missing answers as an explicit fallback to `support` or a configurable error policy.

4. Before implementation, query OpenRouter’s live decision-model catalog. Select a model based on context fit, cost, provider availability, and probe results; pin its versioned `canonical_slug`, never an alias.

5. Probe the pinned model with representative cases:

   - Clear billing, engineering, and support examples
   - Ambiguous tickets
   - No-match and empty input
   - Negated statements such as “I was not charged”
   - Synonyms absent from the old keyword list
   - Adversarial text attempting to influence classification

6. Use the observed probabilities to establish named code-side thresholds or fallback rules. The initial model `choice` is authoritative, but low-probability or closely competing results should use the defined fallback rather than silently making a brittle routing decision.

7. Add response validation:

   - Verify the answer type is `choice`.
   - Verify the selected option is one of the expected keys.
   - Log the resolved model version, selected route, probabilities, latency, and cost without logging sensitive ticket content unnecessarily.

8. Add tests covering the probe cases and failure paths, then re-run the probe suite whenever the decision-model version changes.