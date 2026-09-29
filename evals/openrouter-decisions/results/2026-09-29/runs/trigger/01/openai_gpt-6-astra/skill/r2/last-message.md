Replace the keyword chain with **one Decisions API `choice` question**: “Which team should own the primary issue in `ticket.text`?” The model judges ownership; code handles routing and fallback.

1. **Define the routing rubric.**

   | Choice | Criteria |
   |---|---|
   | `billing` | Invoices, charges, refunds, or subscription payments requiring billing help. |
   | `engineering` | Broken product behavior requiring technical investigation, including crashes and reproducible failures. |
   | `support` | General usage, account assistance, and other customer help. |
   | `none` | No actionable issue, unrelated content, or no identifiable primary issue. |

   Route by the help needed. For example, disputing an incorrect charge goes to billing; a crash while downloading an invoice goes to engineering. Map `none` to support triage, preserving the three public outcomes.

2. **Keep the request minimal.** Send only the original text in `state.ticket.text`, plus the ownership question and criteria. Empty or whitespace-only input returns support directly in code.

3. **Plan the API integration.** Use the skill’s `parseRequest` and `decide` helpers with `POST /api/alpha/decisions`, keeping credentials server-side. This makes routing asynchronous, so callers must await the result. Validate the answer type and allowed choice; treat malformed responses as errors and route timeouts or API failures to support with a recorded fallback reason.

4. **Select a model through evaluation.** During implementation, fetch the live Decisions model catalog, shortlist by context capacity, cost, and availability, then compare candidates on the same labeled tickets. Pin the winning canonical version in configuration.

5. **Tune uncertainty handling from observations.** Initially evaluate the returned `choice` without inventing a confidence cutoff. Use observed probabilities and misrouting costs to establish when ambiguous tickets should fall back to support. Confidence measures distribution concentration, not correctness.

6. **Probe and roll out.** Cover clear examples, mixed billing/technical issues, keyword-free requests, unrelated text, empty input, negation (“It doesn’t crash; I need a refund”), and injected instructions demanding a particular team. Compare against human labels and the existing router in shadow mode. Track misroutes, fallback frequency, latency, cost, and the resolved model version before enabling it.

No code changes or model calls made.