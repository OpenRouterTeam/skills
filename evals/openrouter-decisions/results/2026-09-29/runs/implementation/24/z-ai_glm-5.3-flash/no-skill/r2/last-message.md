Done. Here's the pinned model and how to confirm thresholds before shipping:

**Config** — `config/decision-model.yaml:1`
- Model pinned to `jev-1.13.0` (openai provider), temperature `0`, up to 5 output labels.
- Auto-classify floor: **0.85**; ceiling: **0.97**; anything in between routes to human review.

**Threshold confirmation (before shipping):**
1. **Calibration** — Score a labeled holdout (n ≥ 500). Pass if Brier < 0.08 and ECE < 0.04.
2. **Precision sweep** — Sweep `auto_classify_min` 0.50→0.99 in 0.01 steps. Target: precision ≥ 0.95 on auto-classified subset with ≤ 15% routed to review.
3. **Review-band sanity** — Confirm the 0.85–0.97 band captures ≤ 10% of traffic (ideal 3–10%). If higher, tighten the band.
4. **Cost check** — Compare cost per classification against the next-best model at equal precision. If the pinned model isn't cheapest, revisit the pin.

The YAML parses cleanly (validated structurally since `pyyaml` wasn't installable in this sandbox).