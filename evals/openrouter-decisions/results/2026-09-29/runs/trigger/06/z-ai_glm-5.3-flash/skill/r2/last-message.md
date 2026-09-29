Here's the approach, split into what code decides outright and what the decision model judges.

**Hard Rules (Code Only)**
- Purchase within 90 days, amount ≤ order total, ≤ 2 refunds/customer/year: check these directly in code against your database fields.
- Any failure → human queue, skip the model entirely.
- These aren't judgments; never send them to a decision model.

**Judgment (Decision Model)**
- What's left after the hard rules pass is: *"Is this refund request unambiguous and consistent with its stated reason?"* — a `noul` question.
- State sent to the model: the refund reason text, order line items, amounts, product names, and any customer-provided context. Filtered and structured in code first.
- Code then gates on the returned probability: `is_obvious.noul >= T` → auto-approve; below → human queue.

**Threshold & Rollout**
- Start conservatively (`T ≈ 0.85`), send everything near the gate to humans, and probe with real refund reasons (clear cases, vague reasons, adversarial justifications) before trusting the gate.
- Log every auto-approval with the model, probability, and inputs so you can audit and tune later.
- The 90-day, amount, and frequency checks stay as named constants in code — the model never sees or re-judges them.