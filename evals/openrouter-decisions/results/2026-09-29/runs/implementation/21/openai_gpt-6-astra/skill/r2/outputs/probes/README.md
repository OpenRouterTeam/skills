# Model selection evidence

Catalog and live probes collected on 2026-09-29 using the production question in `src/urgency.ts`. `catalog.json` records model context, price, and provider listings. `cases.json` defines expected rating ranges before the calls. `results/` contains the exact requests and raw comparison responses, including probabilities, resolved builds, latency, cost, and API errors. Empty text is rejected locally and has no model response.

| Resolved model build | Cases passing | Median latency | Total cost for 11 reports |
| --- | --- | --- | --- |
| `typesafe/jev-1.13-20260917` | 11/11 | 248 ms | $0.000269640 |
| `jaredpalmer/kev-4b-20260924` | 10/11 | 792 ms | $0.000131502 |
| `upstage/solar-decide-20260928` | 10/11 | 549 ms | $0.000335850 |

The Respan entries returned HTTP 400 for this request, so their quality was not measured. Their catalog input capacity was also listed as zero. Aliases were excluded by the comparison script.

Jev is pinned because it passed every case. Both Kev and Solar overrated the cosmetic incident that demanded urgency 5 (Kev returned 2; Solar returned 3). Jev returned 1. Jev's observed clear-case zero-based scores were 0, 1, 2, 3.01, and 3.99, supporting nearest-level rounding. Its ambiguous report scored 1.98 (displayed 3); the critical incident demanding a low rating scored 3.72 (displayed 5), with 0.91 probability on the critical level. Negated and resolved failures rated 1. No confidence or probability cutoff was introduced.

Jev's 32,000-token capacity and provider input cap leave room for the bounded report and rubric; the largest short probe used 592 input tokens. Its catalog price was $0.042 per million input tokens, with no output token charge. Only one provider was listed for each measured candidate, so errors remain explicit for the caller's manual triage/retry path.

These are eleven synthetic examples, not a production accuracy estimate or proof of resistance to malicious reports. Service criticality policy, numerical SLA thresholds, and time comparisons are not supplied or inferred by this module. Validate against labeled historical incidents before using rankings operationally. On-call staff should retain manual override and access to the original report.

Run `npm run probe` to repeat the comparison. It reports every candidate and exits unsuccessfully if the pinned model fails an expected range or cannot be measured. A change to the model or rubric requires a new comparison; the captured evidence applies only to the current rubric and resolved build.
