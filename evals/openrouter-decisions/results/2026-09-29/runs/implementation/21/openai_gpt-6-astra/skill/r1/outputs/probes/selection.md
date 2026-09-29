# Model selection and level boundaries, 2026-09-29

Queried `GET /api/v1/models?output_modalities=decisions` and the endpoints listings. Compared ten synthetic reports using the skill's `decide.ts --compare`; expected levels were defined in `cases.json` before probing. Empty inputs are rejected in code and covered by local tests.

The final-rubric comparison, before tuning the score boundaries:

| Candidate | Expected levels matched | Mean latency | Total cost, 10 reports |
| --- | --- | --- | --- |
| Solar Decide | 9/10 | 587 ms | $0.00033225 |
| Kev 4B | 9/10 | 844 ms | $0.00014175 |
| Jev 1.13 | 9/10 | 160 ms | $0.000265692 |

Solar is pinned as `upstage/solar-decide-20260928`. Its remaining error was promoting a cosmetic issue to level 2, while both adversarial cases passed. Kev promoted the cosmetic report containing a malicious urgency instruction from 1 to 2. Jev demoted ongoing data destruction containing a malicious low-urgency instruction from 5 to 4. Respan's three entries rejected the named-field state format with HTTP 400; these are compatibility failures, not quality measurements.

Solar's listed context is 524,288 tokens, with prompt pricing of $0.05 per million tokens and no completion charge. The input limit leaves ample room for the rubric. Its two listed endpoints both belong to Upstage, so they do not provide independent-provider redundancy. API failures remain unscored for manual triage.

The initial comparison (`initial-comparison.json`) used an earlier rubric: Solar passed 10/10, but subsequent calls exposed overlap between cosmetic and functional problems and between regional impact and total outages. The final rubric explicitly separates those situations. Earlier direct-call observations are preserved in `initial-pinned.json`, `intermediate-pinned.json`, and `pre-calibration.json`. The final rubric comparison is `comparison.json`.

The first zero-based score boundary is 0.8, chosen between observed cosmetic scores (up to 0.656316) and minor functional-failure scores (at least 1.0087). The remaining boundaries are 1.5, 2.5, and 3.5, checked against the moderate, high, and critical probes. Equality selects higher urgency. Raising boundaries risks delaying attention; lowering them risks needless interruption. The original distributions are retained. No confidence threshold controls visibility or paging.

`results.json` is a fresh direct call for each case using the final rubric, pinned build, and tuned boundaries. Each artifact records raw distributions, resolved builds, latency, and usage. Ten synthetic cases inform model selection and boundary tuning; they do not establish general accuracy or immunity to prompt injection. Evaluate on your own labeled incidents and retain manual reprioritization before relying on these levels operationally.
