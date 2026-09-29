# Pinned classification model

Selected `typesafe/jev-1.13-20260917` from the live OpenRouter Decisions catalog checked on 2026-09-29. `config.json` is the single runtime model setting; do not replace it with a moving alias. This workspace had no job definition, so the request and probes illustrate mutually exclusive support-ticket labels: billing, account, bug, and none. Replace this rubric and the examples with the actual job before production validation.

One `choice` matches this task. Use its returned `choice` for the baseline prediction. For a different job where multiple labels can apply independently, use one `noul` per label and validate its thresholds separately.

## Observed selection evidence

The bundled `decide.ts --compare` runner evaluated each non-empty ticket independently. Empty input bypasses the model in code. Raw probabilities, resolved model strings, latency, usage, and API errors are retained in `evidence/probes.json`; catalog and provider fit are recorded alongside it.

| Candidate | Correct / 8 | Median latency | Mean cost / call |
| --- | ---: | ---: | ---: |
| Jev 1.13 | 8 | 155 ms | $0.00001818 |
| Kev 4B | 7 | 560 ms | $0.00000528 |
| Solar Decide | 6 | 557 ms | $0.00002233 |

Jev handled the ambiguous, no-match, negated, and adversarial cases in this small sample. Kev is cheaper per observed call but missed the ambiguous case; Solar missed ambiguous and no-match cases. Respan entries advertise zero context and returned HTTP 400 for this state format; their classification quality was not measured. Those errors are retained, not scored as wrong labels.

Jev's catalog price is $0.042 per million input tokens with zero output-token charge. Actual probe inputs were 427–442 tokens against a 32,000-token input cap. These calls average about $1.82 per 100,000 requests at this input size. The catalog lists one TypeSafe provider with 100% uptime over the reported 30-minute window; this is a snapshot, not an availability guarantee. API failures should go to review, without silently switching models. Real maximum-length inputs must also pass a context-fit check.

## Config and routing contract

`config.json` pins the build and starts in shadow mode. The API body consists of `model` from that config plus `state` and `questions` from `request.json`. Runtime must honor shadow mode: record predictions while existing human handling continues. This package provides configuration and evaluation tooling, not a deployed routing service.

The review threshold is deliberately null. Jev's winning probabilities were 0.99–1.00 on these probes, with no observed wrong predictions. That cannot identify where wrong answers separate from correct ones or show that the probabilities are calibrated. Do not invent a 0.8/0.9 cutoff from this sample or treat confidence as accuracy.

Once validated, code compares the probability of the returned choice against its named per-label threshold. A lower threshold increases automatic coverage and risks misrouting (delay or missed service); a higher threshold increases review workload and delay. Send below-threshold, `none`, missing-probability, invalid-response, and API-error outcomes to human review. Empty input is deterministically `none` without an API call. Validate the answer type and labels, and log the resolved response `model` with every answer; a model mismatch disables automatic routing.

## Confirm thresholds before shipping

1. Label representative real traffic using the final rubric. Include all labels, rare classes, long inputs, relevant languages, ambiguous/no-match/off-topic cases, negation, and adversarial instructions. Deduplicate and separate related tickets across tuning and held-out test sets. Keep the hand-written probes as regression checks, not the accuracy estimate.
2. Run the exact pinned model and final questions. Save raw per-label probabilities, returned choice, resolved model, latency, cost, and errors. Audit disagreements with human labels. Inspect reliability by probability bucket: even a probability of 1 is not proof of correctness.
3. On the tuning set, sweep thresholds drawn from observed winning probabilities separately for each label. Compute automatic-routing precision, class recall, error types, coverage, and review volume. Choose thresholds against agreed error costs and review capacity. Record each chosen constant with the supporting rows, dataset/rubric version, and mistake consequences. If no threshold meets the target, keep that label in review.
4. Freeze thresholds, then evaluate once on the untouched test set. Report uncertainty bounds and per-label results, not just aggregate accuracy. For example, *if* the business requires error below 1%, zero errors across roughly 300 independent auto-routed examples provides only an approximate 95% upper bound of 1%; small or underrepresented classes need more evidence. This is an illustrative acceptance target, not a requirement chosen for the user.
5. Replay every regression edge case through the proposed gates and verify the intended route or review action. Test threshold equality, missing/invalid answers, timeouts, and model mismatch. Shadow on fresh traffic and check review capacity, latency, and cost before enabling automatic routing. Rerun selection and threshold validation whenever the model, rubric, or input distribution changes; thresholds do not transfer between builds or primitives.

## Reproduce

Set `OPENROUTER_API_KEY` in the server environment; never put it in config or client-side code. From this directory:

```bash
npm ci --prefix tools
tools/node_modules/.bin/tsx tools/models.ts request.json --json
tools/node_modules/.bin/tsx tools/probe.ts
tools/node_modules/.bin/tsx tools/probe.ts --pinned
```

The last command replays the exact dated pin and rejects a different resolved model. The runners reuse `parseRequest` and `decide` from the skill's bundled library. The pinned replay writes `evidence/pinned-probes.json`; model comparison writes `evidence/probes.json`. Review predicted labels against the stored expected labels before accepting a replay.
