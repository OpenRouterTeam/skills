Here's a sketch that separates **deterministic enforcement** from **judgment**, so your hard rules are never trusted to a model:

## Pipeline

**1. Deterministic gate (code, not model)**

Evaluate the three hard rules in code against your order/refund data:

- Days since purchase ≤ 90
- Refund amount ≤ order total (and not already fully refunded)
- Refunds by this customer in the trailing 365 days < 2

Any rule that fails → **auto-deny** (or route to a policy exception queue, your call). No model needed; these are facts.

**2. Decision model (judgment on the ambiguous remainder)**

For requests that pass the gate, call OpenRouter's Decisions API with a decision model (e.g., `typesafe/jev-1.13`) using typed questions:

- **Noul:** "Is this a straightforward refund where the customer clearly deserves their money back?" — criteria for `true`/`false` referencing evidence (product defect, delivery failure, duplicate charge, buyer's remorse with clear policy, etc.)
- **Noul:** "Is there anything ambiguous about this refund (disputed delivery, damaged-but-used, partial vs full, suspicious pattern)?"
- **Score (optional):** reason clarity on an ordered scale from "obvious approval" to "clearly contestable"

All in one request, against a `state` containing the refund reason, order history, delivery status, and product condition notes.

**3. Threshold-based routing in code**

- `straightforward.noul ≥ threshold` (tune on labeled historical cases, not a round number like 0.9) → **auto-approve**
- Otherwise → **human queue**, with the model's probability attached so agents can triage by confidence.

## Why this shape

- Your three hard rules are cheap, auditable checks — code should own them outright.
- The model only answers "is this obvious or ambiguous?", which is exactly the judgment call your 95%-approval queue is currently making by hand.
- Probabilities let you tune the auto-approve threshold against your actual cost of a wrong approval vs. an unnecessary human review, and you can log every answer for later evaluation.

Want me to scaffold this as a small module or against your actual refund data model?