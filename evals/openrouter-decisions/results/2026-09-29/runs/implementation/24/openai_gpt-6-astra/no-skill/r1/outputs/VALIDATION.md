# Pinned classification candidate

Use `qwen/qwen3-30b-a3b-instruct-2507` through OpenRouter, restricted to
`streamlake`, with provider fallback disabled. This dated, non-thinking model
is a reasonable cost-conscious candidate for short text classification; task
accuracy and latency remain unmeasured. Model and endpoint metadata were checked
on 2026-09-29:

- https://openrouter.ai/api/v1/models
- https://openrouter.ai/api/v1/models/qwen/qwen3-30b-a3b-instruct-2507/endpoints

The selected endpoint advertises JSON schema support. Confirm that with an
authenticated smoke test before evaluation. The model ID and provider restriction
prevent automatic model/provider switching; they do not guarantee immutable
hosted weights, backend behavior, or deterministic outputs at temperature zero.

`decision-model.json` is application configuration, not an entire API request.
Send `api.request` plus `messages` to the configured URL, using the environment
variable for bearer authentication. Render the system prompt with the finalized
label definition and put the input text in a separate user message. Never send
unresolved placeholders. No credentials, classification data, or existing runtime
were supplied; no inference or quality evaluation has been run.

The configuration assumes binary text classification. Define the actual positive
and negative classes, examples, exclusions, and error costs before using it.
For multiple classes, change the schema and validate per-class thresholds.

# Confirm thresholds before shipping

1. **Agree on success.** Confirm precision, negative predictive value, recall,
   review capacity, latency, and cost targets with the job owner. The numerical
   targets in the config are proposals. Positive auto-recall means automatically
   accepted true positives divided by *all* actual positives, including cases
   sent to review. Coverage means automatically classified inputs divided by all
   inputs. Report review outcomes separately.
2. **Build independent labeled splits.** Sample production-like data, including
   class imbalance, languages, sources, difficult cases, and instruction-like
   input. Have ambiguous labels adjudicated. Keep related records in one split
   and use time separation where appropriate. Separate prompt development,
   score calibration, threshold selection, and a final untouched test set.
3. **Calibrate scores.** Freeze the prompt, label definition, model, provider,
   and schema. Fit a sigmoid or isotonic calibrator on the calibration split;
   inspect reliability plots and Brier score on independent data. A model's
   self-reported score is not a calibrated probability. If scores do not rank
   cases reliably, improve or replace the candidate instead of treating 0.9 as
   90% confidence. Version the fitted calibration artifact.
4. **Select thresholds.** Sweep lower and upper cutoffs on the threshold-selection
   split. Choose the pair with greatest automatic coverage that meets the agreed
   precision, negative predictive value, and recall bounds. The 0.1/0.9 pair is
   only a starting point. Route scores between the cutoffs to review. Explicit
   abstention, invalid JSON, missing fields, nonfinite/out-of-range scores,
   truncated responses, and API failures must also go to review. Include these
   cases in coverage and operational recall denominators.
5. **Run the frozen test once.** Report confusion counts, precision, negative
   predictive value, auto-recall, coverage, review volume, schema/error rate,
   p95 end-to-end latency, and measured cost per input. Use one-sided 95% Wilson
   lower bounds for the proposed quality gates, and check important slices with
   adequate sample sizes. For example, even with zero errors, approximately 133
   independent accepted predictions are needed for a one-sided 95% Wilson lower
   bound of 98%; this is a statistical floor, not a recommended dataset size.
   Never tune on this test set. After a failed gate and any changes, obtain fresh
   held-out evidence. If no thresholds meet the targets, keep release disabled.
6. **Exercise boundaries and rollout.** Verify scores exactly on each cutoff and
   immediately above/below it, explicit abstention, invalid/truncated output,
   provider unavailability, and prompt injection examples. Shadow production
   traffic, then canary with labeled audits and agreed rollback triggers for
   quality, review volume, latency, and errors. Monitor class/slice drift.

For release, save the dataset/split hashes, label rubric, rendered prompt hash,
model/provider settings, calibration artifact/hash, chosen thresholds, evaluation
report, and owner-confirmed targets. Set `validated_negative_max` and
`validated_positive_min` only from the passing evaluation, then enable release.
Recalibrate and repeat validation after any model, provider, prompt, schema, label,
or calibration change.

This repository contains configuration and a validation procedure only. The
consuming application must enforce the release gate: reject automatic decisions
while release is disabled, required artifacts/definitions/targets are missing,
or validated thresholds do not satisfy `0 <= negative_max < positive_min <= 1`.
After explicit abstention/error handling, scores at or below the lower cutoff
are negative; scores at or above the upper cutoff are positive; all others go
to review. Candidate thresholds must never be used as a runtime fallback.
