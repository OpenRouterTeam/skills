# Classification model and release plan

Selected model: **Claude Haiku 4.5**, through OpenRouter, using only the
Anthropic provider. This is a starting candidate for text classification with
short structured outputs, not a measured winner for an unspecified job.
The live OpenRouter catalog advertises structured output support and maps
`anthropic/claude-haiku-4.5` to `anthropic/claude-4.5-haiku-20251001`.

`classification.config.json` is application configuration. Only its `request`
object belongs in the chat-completions request, along with messages and a strict
JSON response schema. Do not send the pin or release settings as API parameters.
Before inference, define the actual labels and rubric, version the prompt, and
constrain the output schema to those labels. Treat input text as data rather
than instructions. Truncated, malformed, missing-label, or failed responses go
to review; they must never become a default negative decision.

## Pin verification

Run `python verify_model_pin.py` before evaluation and deployment. Run the same
check at application startup, and stop if the catalog mapping changes. The
request model is the public OpenRouter ID; the dated canonical slug is a guard,
not an assumed callable model ID. Provider fallbacks are disabled. An unavailable
provider sends the item to review or a retry queue, never to another model.

This guard checks OpenRouter's advertised mapping; it cannot guarantee immutable
provider internals. Record the model, provider, prompt/schema versions, calibration
artifact, and threshold version with evaluation results and production decisions.
Any change requires another evaluation. Temperature zero reduces variability but
does not guarantee identical responses.

## Confirm thresholds before shipping

The candidate rule is: accept the highest-scoring label only when its calibrated
probability is at least 0.90 and exceeds the runner-up by at least 0.15; otherwise
send it to review. These numbers are starting hypotheses, not validated cutoffs.
For binary or multilabel jobs, use the corresponding class-specific decision
rule and explicitly measure both false positives and false negatives.

1. Define the label rubric and business costs of each mistake. Fill in required
   per-label precision and recall, review capacity, latency, and cost limits.
   No universal target is safe to assume for an unspecified classification job.
2. Assemble independently labeled examples representative of production,
   including rare labels, ambiguous inputs, out-of-domain text, and important
   slices such as language or customer group. Adjudicate disagreements. Split
   by source/entity and time where appropriate to prevent duplicate leakage.
   Keep calibration, threshold-selection, and final test sets separate.
3. Run the exact pinned model, provider, prompt, schema, and decoding settings.
   If collecting model-reported scores, treat them as raw features, not reliable
   probabilities. Fit a calibration mapping on the calibration split; assess
   reliability plots, Brier score, and calibration by label. If the scores do
   not discriminate useful decisions, revise the scoring approach or model.
4. Sweep per-label cutoffs and the ambiguity margin on the threshold-selection
   split. Select the highest automated coverage satisfying the business targets
   and review capacity. Precision is measured among accepted decisions; report
   recall against all true examples, including abstentions, so sending everything
   to review cannot appear successful. Also report false-negative and
   false-positive rates, confusion matrices, and coverage by class and slice.
5. Freeze the full configuration and evaluate once on the untouched test set.
   Require the one-sided 95% lower confidence bounds for required precision and
   recall to meet their targets, with adequate support per class/slice. Choose
   sample sizes from the targets rather than declaring a small sample sufficient.
   For illustration, 59 independent accepted decisions with zero errors give a
   one-sided exact 95% precision lower bound just above 95% for one class; this
   does not establish recall or simultaneous guarantees across many classes.
   Account for multiple comparisons when gating many slices. Measure schema
   failures, review rate, actual billed cost, and p95 latency under realistic load.
6. Release only after the report passes all filled-in requirements. Start in
   shadow mode, then use a limited canary with review and a rollback path. Monitor
   labeled error rates, coverage, drift, latency, and cost. A failed test requires
   a revised candidate and a fresh untouched test set before claiming validation.

The config remains `evaluation_only`: labels, calibration, business targets,
and held-out evidence have not been supplied. No paid inference or accuracy
evaluation has been performed.

Sources: https://openrouter.ai/api/v1/models and
https://openrouter.ai/api/v1/models/anthropic/claude-haiku-4.5/endpoints
