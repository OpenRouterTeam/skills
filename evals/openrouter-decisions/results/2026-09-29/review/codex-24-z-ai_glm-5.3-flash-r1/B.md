# codex-24-z-ai_glm-5.3-flash-r1

Request given to the agent:

> Pick a decision model for a new classification job and pin it. Show the config and how you would confirm the thresholds before shipping.

## Candidate B

(no files were written)

### Final message


Here's the pick, the config, and the threshold-confirmation plan.

**Decision model**
- **Pinned:** `upstage/solar-decide-20260928` (canonical slug, not the alias)
- **Why:** Newest decision-model build on the live catalog (released 2026-09-28), cheapest prompt pricing ($0.05/M tokens, completion $0, 50% provider discount), 524k context, 100% uptime, single Upstage provider.

**Config**

```toml
# decisions.toml
[classification]
model        = "upstage/solar-decide-20260928"  # canonical_slug, never the alias
primitive    = "choice"                          # one label from a written rubric
labels       = ["priority_high", "priority_medium", "priority_low", "none"]
question     = "Which priority level best fits this ticket?"
gate_auto    = 0.80   # auto-assign when top probability >= 0.80
gate_review  = 0.50   # route to human review when top probability in [0.50, 0.80)
gate_default = "priority_low"  # below 0.50, default with trace
```

**Confirming thresholds before shipping**
1. **Build a probe set** covering: clear cases (one unambiguous example per label), an ambiguous case, a no-match case, an empty/off-topic input, a negated statement, and adversarial text arguing for its own label.
2. **Run through `decide.ts --compare`** (or `--model upstage/solar-decide-20260928`) so you see raw `probabilities` and `confidence` per case, not just the top label.
3. **Read the gap:** for each clear case, check the top probability clears `0.80` with room to spare. For the ambiguous and adversarial cases, check the top probability falls in the review band, not above it.
4. **Adjust gates from observed numbers**, not defaults — if clear cases land at 0.72, the auto-gate is too strict; if adversarial cases score 0.85, tighten it. Every threshold must trace to a number you saw.
5. **Re-probe on any model change.** Thresholds do not carry between builds. A swap is a config edit plus a full step-8 rerun.
6. **Log the response `model` string** with every stored answer so later drift is traceable.
