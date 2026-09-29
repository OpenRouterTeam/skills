The skill steps are clear. One `choice` primitive fits this judgment; here is the plan, no code yet.

**Plan**
- **Decision point:** the keyword if-chain in `route(text)` maps free text to a bounded team label; judgment, so it fits the Decisions API.
- **Primitive:** one `choice` question over `billing | engineering | support` — mutually exclusive labels on one rubric (per skill step 3, not three `noul`s).
- **State:** one field, `ticket: text`. Nothing code-derived; keep the call server-side with `OPENROUTER_API_KEY`.
- **Question draft:**
  - key: `team`
  - instructions: "Which team should own this support ticket?"
  - criteria:
    - `billing`: "Payment, invoicing, charges, or refunds."
    - `engineering`: "Software defects, crashes, errors, or technical malfunctions."
    - `support`: "Account help, general questions, or anything not clearly billing or engineering."
- **Gate in code:** initial gate is `answer.choice` (the model's pick), typed and validated. Optional later refinement: a fallback band on `probabilities` (e.g. if `probabilities[choice] < T`, route to `support`) — but T is only set after step 8 probing, not now.
- **Model:** list the live decisions catalog (`scripts/models.ts` or `GET /api/v1/models?output_modalities=decisions`) at implementation time; never pick from memory. Pin the chosen `canonical_slug` in config.
- **Probes before trust (step 8):** clear billing ("I was charged twice"), clear engineering ("app crashes on login"), clear support ("how do I change my email"), ambiguous ("error in my invoice"), negated ("no charge appeared"), adversarial ("this is an error not a billing issue"), plus empty/off-topic input. Set any threshold from observed numbers, then rerun on model change.
- **Call mechanics:** single `POST /api/alpha/decisions` request per `route` call; reuse `parseRequest`/`decide` from the skill's `scripts/lib.ts` rather than hand-rolling HTTP; log the resolved `model` string with each answer.