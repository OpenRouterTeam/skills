# Pinned classification example

Assumption: short support tickets, one primary label among billing, account,
bug, and none. Actual job labels, traffic, input lengths, and mistake costs
have not been provided. This selection is provisional for that example.

`config.json` is the single source of the model pin. Merge its `model` into
`request.json` when calling the API; other config fields are application policy,
not Decisions API request fields. Keep OPENROUTER_API_KEY server-side.

## Selection evidence (2026-09-29)

The live catalog and endpoint report are in `results/catalog.json`. Raw answers,
resolved model strings, usage, and measured latency are in `results/comparison-*.json`.
Nine synthetic probes cover clear cases for each label, ambiguity, no match,
empty input, off-topic input, negation, and adversarial classification instructions.

| Model build | Labels matched | Median latency | Total reported cost, 9 calls | Context |
| --- | --- | --- | --- | --- |
| typesafe/jev-1.13-20260917 | 9/9 | 157 ms | $0.000161532 | 32,000 |
| jaredpalmer/kev-4b-20260924 | 9/9 | 564 ms | $0.000045444 | 8,192 |
| upstage/solar-decide-20260928 | 8/9 | 521 ms | $0.000198500 | 524,288 |

Choose Jev for observed latency and context headroom. Kev is a reasonable
cost-first challenger; this sample does not establish a quality difference.
Solar classified a feature request as a bug (P(bug)=0.707518). Respan entries
publish a zero context limit and rejected this state shape with HTTP 400;
these errors are integration observations, not quality measurements.

Jev's published input price is $0.042/million tokens, with zero output cost.
Actual probes used at most 436 input tokens, well inside the provider's 32,000
limit. At 1,000 input tokens and 100,000 calls/day, nominal input cost is
$4.20/day; use actual usage and traffic for budgeting. Each shortlisted model
had one distinct provider and reported 100% uptime over the previous 30 minutes.
That snapshot is not an availability guarantee; errors must preserve review.

## Gate and threshold confirmation before release

Use `choice` because the labels are mutually exclusive. Before calibration,
record the returned `choice` as the shadow prediction. There is no justified
numeric gate yet: selected probabilities on Jev were 1.0 except the no-match
case at 0.98. These mostly saturated correct examples cannot locate a useful
decision boundary or estimate production error rates. Confidence measures
distribution concentration, not correctness.

1. Finalize the real rubric and have people label representative production
   inputs. Include each class, rare costly mistakes, ambiguous and no-match
   cases, negation, adversarial instructions, long inputs, and relevant languages.
   Separate calibration data from a locked test set by customer/thread and time
   to reduce leakage. Use enough examples per class to bound the error rate the
   business will tolerate; nine synthetic examples cannot do that.
2. Establish acceptable misrouting rates, review capacity, latency, and cost.
   A false automatic route delays the customer and sends work to the wrong team;
   an unnecessary review consumes operator time and delays an otherwise correct
   route. Weight those consequences per class when selecting cutoffs.
3. Run the exact pinned build and frozen rubric. Store the full probabilities,
   selected label, response model, expected label, usage, and latency per case.
   Check probability calibration/reliability as well as classification accuracy.
   Do not interpret a returned 0.95 as a verified 95% success rate.
4. On calibration data, sweep cutoffs at observed selected-label probabilities
   and, if useful, observed gaps between the two highest probabilities. Pick
   per-label thresholds maximizing coverage subject to error-cost and review
   constraints. Record which examples and observed numbers justify each cutoff.
   Evaluate the frozen policy on the untouched test set: per-class precision and
   recall, confusion matrix, automatic-route error rate with confidence intervals,
   review rate, p95 latency, and cost. If no cutoff satisfies the constraints,
   revise the rubric/model or keep review; do not invent a stricter number.
5. Shadow on real traffic, inspect failures and near-boundary examples, then
   enable automatic routing only when the predefined targets hold. Monitor
   the same metrics and restore review on regression. A change to model, rubric,
   labels, or input distribution requires revalidation; thresholds do not transfer.

The application owns the gate:

```text
empty input -> none, skip model
API error, missing answer, invalid type/probabilities, unexpected model -> review
log response.model with answer and rubric_version
shadow mode / auto_route_enabled=false -> review, retain shadow prediction
choice=none -> review
selected probability below that label's validated cutoff -> review
top-two margin below validated cutoff (if enabled) -> review
otherwise -> route to returned choice
```

`thresholds.min_selected_probability_by_label` stays null until calibration
produces a mapping for billing/account/bug. Missing thresholds must block
automatic routing. The optional margin cutoff stays null if it does not improve
the validated policy. Threshold comparisons belong in application code.

## Reproduce

The supplied skill's `scripts/decide.ts` uses its validated `parseRequest` and
`decide` helpers. Install its dependencies in a writable copy, then run:

```bash
npx tsx models.ts /absolute/path/to/classification/request.json --json
npx tsx decide.ts /absolute/path/to/classification/probes/billing.json --compare
```

Repeat comparison for each probe except `labels.json`, which holds the expected
labels. Compare prints candidate errors inline. For an exact-pin call, read
`config.json.model` and pass it as `--model` to `decide.ts`. Confirm the returned
`model` equals the pin. `results/pinned-billing.json` records this check.

The empty-input API probe tests behavior only; the production path should skip
that call deterministically. This directory provides a config and release plan,
not an implemented application router. Automatic routing remains disabled.
