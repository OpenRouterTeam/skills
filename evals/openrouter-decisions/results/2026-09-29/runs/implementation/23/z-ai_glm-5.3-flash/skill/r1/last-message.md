Added `subscription-return-check.ts`.

- Date arithmetic and missing/empty reasons are handled entirely in code, skipping the model call when the answer is already settled.
- For subscriptions older than one year with a cancellation reason, it calls the OpenRouter Decisions API (`noul` primitive, pinned model `typesafe/jev-1.13-20260917`) to judge return likelihood from the reason text.
- A `0.7` probability gate turns the model's answer into a boolean; the threshold is documented for tuning with representative inputs.
- Live probes confirmed clear separation: temporary reason scored `0.72` (returns), product-quality complaint scored `0.11` (does not return).