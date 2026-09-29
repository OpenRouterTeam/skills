Here's my plan to fix the misrouted tickets. The root cause is structural: keyword maps force a hard boundary over messy, colloquial customer language. "You took money from me twice" describes a billing event in plain words, with zero overlap to your map keys. Rather than pile more keywords onto a brittle list, replace the guess with a probability-based judgment the code can act on with thresholds.

## Plan

**1. Locate the decision point.** The router maps free text → one of three queues (`billing`, `engineering`, `support`) by exact keyword match. That's a judgment call ("which team should own this?") currently expressed as pattern matching. It fits a `choice` primitive: three mutually exclusive options, relative comparison between them.

**2. Keep computation in code.** The keyword map can remain as a fast-path layer — exact matches like "invoice" or "crash" route immediately without a model call. Only inputs that miss all keywords fall through to the decision model. This keeps cost and latency low while closing the gap.

**3. Define the `choice`.** One question over the ticket text with three criteria, each restated as a property of the ticket, not of the words in it:
- `billing`: the customer reports a financial transaction, charge, refund, duplicate payment, subscription cost, or account balance issue.
- `engineering`: the customer reports a malfunction, crash, bug, error, or broken feature.
- `support`: anything else — general questions, how-to help, account changes.

Include a `none`/fallback criterion if any input could plausibly fit none of the three (even if you then default to `support` in code).

**4. Build minimal state.** Send only the ticket text (and subject if available). No metadata the model doesn't need.

**5. Gate in code.** Take the highest-probability choice. Set a confidence floor (say `0.70` to start, tuned in step 6): above the floor, route directly; below it, send to `support` as the safe default or to a human review queue if one exists. The consequence of each miss — a billing ticket landing in engineering wastes an engineer's time — should be written next to the threshold.

**6. Probe before trusting.** Run representative inputs through the Decisions API: your known miss ("you took money from me twice"), obvious hits ("my invoice is wrong", "app crashes on launch"), ambiguous cases ("I was charged for something I didn't buy"), off-topic text, and adversarial inputs. Read raw probabilities per option, then set the threshold from what you observe — not from a cookbook default.

**7. Measure and iterate.** After deploy, sample misrouted tickets weekly. If a category shows up repeatedly below threshold, tighten the criteria wording or adjust the gate — not the keyword list.

Want me to draft the actual Decisions API request shape next, or run the probe set against a live model first?