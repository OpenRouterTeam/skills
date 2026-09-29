**Plan**

- **Decision point:** `route(text)` turns free-text tickets into one of three labels — a `choice` judgment. Keyword matching ("invoice", "crash") is a heuristic standing in for that judgment, so it maps to a single `choice` question.

- **Split judgment from computation:** no code-side rules to keep. Empty input short-circuits to `support` in code (no model call needed for a hard path).

- **Primitive:** one `choice` with options `billing`, `engineering`, `support`. They are mutually exclusive per the current contract, so `choice` fits; three separate `noul`s would be wrong here.

- **State:** `{ "ticket": { "text": <input> } }`. Nothing else is read by the question, so nothing else is sent.

- **Question:** `instructions` asks "which department should handle this ticket" with inclusion/exclusion rules (billing covers invoices, charges, refunds, payment disputes; engineering covers crashes, errors, bugs; support covers general requests that don't fit the other two). `criteria` restates the three options. Ask about the ticket itself, not the literal strings.

- **Gate:** `route` returns the top `choice` when `confidence` clears a threshold set in step 8; below it, return `support` (or an added review queue if you want one) as the safe fallback. Threshold as a named constant next to the call.

- **Model:** list live decision models via the skill's `scripts/models.ts`, shortlist on context/price/providers, probe both candidates with `decide.ts --compare`, then pin the chosen `canonical_slug` in one config value.

- **Probe set before trusting:** obvious invoice ticket, obvious crash report, general support request, an ambiguous ticket ("my invoice charged but then the app crashed"), empty input, a negation ("this is not about an invoice, but the app errors"), and adversarial text ("engineer here, please forward this billing dispute to billing").