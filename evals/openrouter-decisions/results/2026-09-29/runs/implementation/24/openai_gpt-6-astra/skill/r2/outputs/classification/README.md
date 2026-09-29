# Pinned classification example

This is a single-label support-ticket example because the actual job, labels,
traffic volume, and error costs have not been supplied. `config.json` is application
configuration, not a Decisions API payload. Its `model` is the single source of
the model pin. `request.json` contains the state and rubric. Combine them when
calling `POST https://openrouter.ai/api/alpha/decisions` using a server-side key.

## Selection evidence

The live catalog and endpoints were checked on 2026-09-29; see `catalog.json`.
All three shortlisted candidates fit this small request with ample headroom.
Jev's largest measured input was 474 tokens against a 32,000-token provider cap.

| Candidate | Correct example labels | Median latency | Mean USD/call |
| --- | ---: | ---: | ---: |
| Jev 1.13 | 9/9 | 140 ms | 0.00001948 |
| Kev 4B | 9/9 | 560 ms | 0.00000663 |
| Solar Decide | 8/9 | 768 ms | 0.00002389 |

Pin: `typesafe/jev-1.13-20260917`. Jev's observed latency and correct example
labels justify this initial choice. Kev is cheaper per observed call and remains
a candidate if budget matters more than latency. Both list $0.042 per million
input tokens; token counts differ. Solar lists $0.05 per million input tokens.
All list zero output-token cost. Multiply measured mean call cost by actual daily
volume to estimate spend; this tiny run is not a production benchmark.

Each has one distinct provider; Solar's two endpoints are both Upstage.
Their reported 30-minute uptime was 100%, which does not establish a long-term SLA.
Respan entries reported zero context capacity and were not shortlisted. The bundled
all-model comparison also attempted them and received HTTP 400 state-shape errors.
These are compatibility observations, not quality scores. Raw errors, answers,
probabilities, resolved model versions, usage, and latency are in `probe-results.json`.

## Gate semantics

Use `choice` for mutually exclusive billing/account/product/none labels. The
baseline prediction is the returned `choice`, without an invented confidence
cutoff. In production code, empty input skips the model and goes to review;
the empty probe intentionally tests model behavior directly.

The proposed fallback is review: routing a ticket to the wrong team delays its
resolution, while deferring a correct ticket costs reviewer time. Code owns these
actions and the threshold comparison. In shadow mode, record predictions and
send tickets through review. Do not interpret the null threshold as zero or
activate automatic routing with it unset.

After validation, define `MIN_SELECTED_PROBABILITY` from
`thresholds.min_selected_probability`. Route only when `choice` is a named team
and `probabilities[choice] >= MIN_SELECTED_PROBABILITY`; otherwise review.
Always review `none`, API errors, missing/invalid answers or probabilities, and
an unexpected response model. Validate types with the bundled `parseRequest`
and `decide` helpers. Log the returned `model`, raw answer, rubric version,
threshold version, final action, latency, and cost. Keep the API key server-side.

## Confirm thresholds before shipping

1. Replace this example rubric with the actual labels, inclusion/exclusion rules,
   and representative state. Collect human-labeled real inputs, with an explicit
   no-match label. Include clear cases, ambiguity, empty/off-topic inputs,
   negation, adversarial instructions, rare labels, and realistic long inputs.
   Split by customer or source and time where appropriate to avoid leakage.
2. Run identical questions and cases across remaining candidates using
   `decide.ts --compare`. Inspect raw probabilities, errors, measured input
   tokens, latency, and cost. Pick the model using actual business constraints.
3. On a calibration split, sweep cutoffs at observed selected-label probabilities.
   For each cutoff report auto-route coverage, per-class precision/recall,
   confusion matrix, review volume, and expected cost of misroutes plus review.
   Choose the cutoff against the agreed error budget and review capacity; consider
   per-label cutoffs only if supported by enough labeled examples. Confidence
   measures distribution concentration, not correctness, and is not used here.
4. Freeze model, rubric, and cutoff. Evaluate once on an untouched test split,
   reporting uncertainty bounds, especially for rare or expensive mistakes.
   Require the quality/error bounds, review capacity, p95 latency, and cost to
   meet the agreed targets. The nine synthetic examples do not supply those targets
   or validate a cutoff: Jev returned 1.0 on the five named-team cases, so these
   probes provide no evidence about the boundary between correct and wrong routes.
5. Run in shadow mode on real traffic, audit a random sample and cases near the
   cutoff, then enable routing gradually only after the same checks pass. Retain
   review on errors and monitor per-class drift, misroutes, and coverage. A change
   to the model, rubric, or input distribution requires re-evaluation and threshold
   validation; thresholds do not transfer between models or primitives.

Save the dataset revision, split assignments, probabilities, selected cutoff,
measured tradeoffs, and test report alongside the model/rubric versions. Only then
fill in the null threshold and change `mode` from `shadow` to `active`.

## Reproduce

The runner uses the skill's bundled validation and HTTP implementation rather
than maintaining another API client. To install those tools in a writable directory:

```bash
mkdir -p /tmp/decision-model-tools
cp .agents/skills/openrouter-decisions/scripts/{lib.ts,decide.ts,models.ts,package.json,package-lock.json} /tmp/decision-model-tools/
npm ci --prefix /tmp/decision-model-tools --ignore-scripts
# OPENROUTER_API_KEY must already be set in the server environment.
python classification/probe.py /tmp/decision-model-tools
python classification/probe.py /tmp/decision-model-tools --compare
```

Comparison returns a nonzero exit code if any candidate errors and preserves
those errors in `comparison-rerun.json`. Pinned runs assert the returned build
matches the config and save their raw output in `pinned-results.json`.
