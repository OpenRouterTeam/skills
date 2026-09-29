# Classification threshold sign-off

The job uses `gpt-5.6-luna` and sends probabilities between 0.05 and 0.95 to
human review. The thresholds are policy gates, not claims that the model's raw
probability is calibrated.

Before shipping, run the pinned model and the exact production prompt/schema on
an untouched, time-based labeled holdout (`validation/classification_holdout.jsonl`).
Do not tune thresholds on this holdout.

Sign off only if all of these hold:

1. At `p >= 0.95`, positive precision is at least 0.98, with a 95% bootstrap
   lower confidence bound still at least 0.98.
2. At `p <= 0.05`, negative precision is at least 0.98, with the analogous
   lower confidence bound at least 0.98.
3. Combined auto-decision coverage is at least 70% and review rate is at most
   30%.
4. Recall is at least 0.90 in every predeclared business-critical slice (and
   each slice has its minimum sample size recorded).
5. Reliability/calibration plots show no material threshold-band failure; if
   probabilities are not calibrated, fit calibration only on a separate
   calibration split and re-evaluate once on the untouched holdout.
6. The confusion matrix and expected error cost are approved by the business
   owner, including the cost of a false positive, false negative, and review.

Record the dataset hash, prompt/schema version, model ID, sample counts, point
estimates, confidence intervals, slice results, and approver in the release
record. If any gate fails, keep the job in review-only/shadow mode and retune on
training/calibration data; do not relax a threshold based on the holdout.

Reference: [OpenAI model catalog](https://developers.openai.com/api/docs/models)
and [GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
