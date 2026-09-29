Plan:

1. Replace the keyword `if` chain with one Decisions API `choice` question over `ticket.text`.

   Options:

   - `billing`: invoices, charges, payments, refunds, or subscription billing.
   - `engineering`: bugs, crashes, errors, outages, or broken product behavior.
   - `support`: how-to questions, account help, configuration, or other customer assistance.
   - `none`: empty, unintelligible, or unrelated input.

2. Update `route` to be asynchronous, since it must call OpenRouter:

   `route(text: string): Promise<"billing" | "engineering" | "support">`

   Map `none`, malformed responses, API failures, and timeouts to the existing safe fallback, `support`.

3. Send only the named state field:

   ```json
   {
     "state": { "ticket": { "text": "..." } },
     "questions": {
       "team": {
         "type": "choice",
         "instructions": "Which team should own this customer ticket?",
         "criteria": { "...": "..." }
       }
     }
   }
   ```

4. Query the live Decisions model catalog, select a model based on context fit, cost, availability, and observed routing quality, then pin its `canonical_slug` or versioned ID in configuration. Do not use an alias.

5. Probe the selected candidates with representative cases:

   - clear billing, engineering, and support tickets;
   - ambiguous tickets;
   - empty and off-topic text;
   - negated wording;
   - adversarial text that tries to influence classification.

   Set any confidence or fallback thresholds from those observed probabilities. The initial implementation can use the returned `choice` directly, with `support` as the failure fallback.

6. Validate the response type and required fields before using it. Log the exact returned model version, latency, and usage cost for observability.

7. Add tests covering the probe cases, API failures, malformed responses, `none`, and preservation of the three-value public return type.

No code changes will be made until you approve this plan.