**Migration Plan**
- **Primitive**: one `choice` with options `billing`, `engineering`, `support` (plus a fallback if ambiguous), because the outcomes are mutually exclusive labels over unstructured ticket text.
- **State**: send a single named field, e.g. `ticket.text` with the raw user message. Don’t pre-lowercase or extract keywords — the judgment belongs to the model.
- **Question instructions**: ask “Which team should handle this ticket?” with inclusion rules per team: `billing` = invoices, charges, payments, refunds; `engineering` = bugs, crashes, errors, technical failures; `support` = general help, account access, questions.
- **Criteria**: each option gets a short standalone rubric line, plus a fallback option (e.g. `unclear`) for ambiguous or empty inputs.
- **Code flow**: build state → call Decisions API → read `choice` and `probabilities` → route on `choice`. If confidence is low (probability below a named threshold, set after probing), fall back to a default queue or escalate rather than guessing.
- **Model**: select from the live Decisions catalog at implementation time (`scripts/models.ts` or `GET /api/v1/models?output_modalities=decisions`), pin the chosen `canonical_slug` in config, keep the API key server-side.
- **Probing**: run representative inputs (clear billing, clear engineering, clear support, ambiguous, empty/off-topic, negated, adversarial) through `decide.ts --compare`, then set the confidence threshold from observed probabilities.
- **Kept in code**: threshold comparison, fallback band, logging of resolved model string. All business rules stay deterministic; only the text→label judgment moves to the decision model.

Ready to implement in TypeScript when you give the go-ahead.