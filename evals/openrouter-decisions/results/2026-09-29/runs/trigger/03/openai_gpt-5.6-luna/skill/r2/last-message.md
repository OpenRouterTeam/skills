I’d replace the keyword map with a layered classifier:

1. Define the routing taxonomy clearly:
   - `billing`: charges, duplicate charges, refunds, invoices, payment failures, subscriptions
   - `engineering`: crashes, bugs, errors, outages, broken functionality
   - `support`: account help, how-to questions, general requests
   - `unclear`: insufficient information or genuinely ambiguous cases

2. Keep deterministic rules for unambiguous signals already available in structured data, such as an existing billing ticket form, account event, or payment transaction ID.

3. For remaining tickets, use an OpenRouter Decisions `choice` question over the four destinations. Give the model the ticket text and concise definitions, including paraphrases such as:

   - “you took money from me twice” → `billing`
   - “I was charged twice” → `billing`
   - “the app crashes when I log in” → `engineering`
   - “how do I change my password?” → `support`

   The model should classify the customer’s actual issue, not merely look for exact words.

4. Add an explicit `unclear` option. Do not force every ticket into a department; low-probability or ambiguous cases should go to a small human-review queue or a general triage queue.

5. Let code apply the routing policy:
   - High-confidence billing → billing
   - High-confidence engineering → engineering
   - High-confidence support → support
   - Close probabilities or low confidence → review/fallback
   - Preserve the raw probabilities and selected model version for auditing

6. Build a probe set from historical tickets, including exact keyword cases, paraphrases, negations, mixed issues, empty messages, and adversarial or quoted text. Measure per-route precision and especially the cost of misrouting billing tickets.

7. Tune thresholds from those results. Billing misroutes may deserve a stricter escalation policy than harmless support misroutes. Monitor confusion rates, review volume, reassignment rate, and customer resolution time.

8. Roll it out gradually:
   - Shadow-classify tickets while the keyword router remains active
   - Compare predictions with actual destinations and human corrections
   - Canary the new router on a small percentage
   - Retain a kill switch and fallback route

The key correction is to classify intent semantically with a bounded choice and probabilities. “You took money from me twice” expresses a duplicate-charge problem even though it contains neither “invoice” nor “charge.”