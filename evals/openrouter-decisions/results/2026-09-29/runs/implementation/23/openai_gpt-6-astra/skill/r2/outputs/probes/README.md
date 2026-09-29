# Model selection and threshold probe

Run on 2026-09-29 using the exact question exported by `src/subscription.ts`.
`catalog.json` records the live catalog, prices, and provider information.
Each `*.request.json` contains a synthetic reason; its `*.results.json` records
raw answers, resolved builds, latency, cost, and errors from `decide.ts --compare`.

The fitting candidates were Solar Decide (524,288-token context), Kev 4B (8,192),
and Jev 1.13 (32,000), each with one provider reporting 100% recent uptime.
The largest observed input was 509 tokens, comfortably within all three limits.
The Respan entries advertised zero context and the comparison runner also
confirmed that they reject this named-field state shape (HTTP 400). Those
errors do not measure classification quality. The moving Jev alias was excluded.

| Case | Expected | Solar | Kev | Jev |
| --- | --- | ---: | ---: | ---: |
| Planned return | true | 0.969431 | 0.9062 | 0.88 |
| Temporary obstacle with expected return | true | 0.947264 | 0.9398 | 0.93 |
| Permanent departure | false | 0.017040 | 0.0044 | 0.02 |
| Ambiguous possibility without plans | false | 0.090093 | 0.0353 | 0.06 |
| Cost alone | false | 0.032180 | 0.1881 | 0.13 |
| Off-topic | false | 0.089592 | 0.3068 | 0.07 |
| Empty | false | 0.062136 | 0.3342 | 0.12 |
| Negated return | false | 0.040991 | 0.0024 | 0.02 |
| Adversarial classification instruction | false | 0.023798 | 0.0029 | 0.02 |

All three passed at the initial `>= 0.5` gate. Select
`typesafe/jev-1.13-20260917`: observed latency was 140–278 ms, versus 381–605 ms
for Solar and 713–1,613 ms for Kev. Jev cost about $0.000017–$0.000018 per
request; Kev was cheaper ($0.000005–$0.000006), while Solar cost about $0.000025.
Jev's lower latency and wider separation from the gate on off-topic/empty text
favor it for this interactive check. The sample is too small to establish a
general accuracy ranking or a calibrated resubscription forecast.

Keep the 0.5 threshold: all Jev negatives were at most 0.13 and positives at
least 0.88, providing no evidence to justify a stricter gate. Blank input is
included as a diagnostic here, but the function handles it locally without
calling the model. Rerun `npm run probe` when changing the model or rubric,
and validate on representative labeled customer reasons before relying on the
classification for business decisions.
