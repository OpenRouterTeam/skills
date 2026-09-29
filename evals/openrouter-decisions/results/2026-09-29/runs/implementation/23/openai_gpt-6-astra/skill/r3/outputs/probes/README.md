Live probe run: 2026-09-29. Each request uses the same question as the function.
The adjacent JSON files preserve inputs, expected outcomes, raw probabilities,
resolved model versions, API errors, latency and cost.

| Model build | Correct at 0.5 | Mean latency | Total cost, 9 examples |
| --- | --- | --- | --- |
| typesafe/jev-1.13-20260917 | 9/9 | 262 ms | $0.000156996 |
| jaredpalmer/kev-4b-20260924 | 9/9 | 771 ms | $0.000051156 |
| upstage/solar-decide-20260928 | 9/9 | 729 ms | $0.000223650 |

Selected Jev for its lower observed latency and separation across these examples.
Kev was cheaper. Jev's largest request used 426 input tokens against its 32,000
token capacity. The catalog listed one provider for each of these models with
100% uptime over the preceding 30 minutes; this is only a snapshot.
Respan candidates rejected this object-shaped state with HTTP 400, so their
classification quality could not be assessed.

For the selected Jev build, direct return intent scored 0.88 and a temporary break
scored 0.92. Permanent departure, ambiguity, cost alone, off-topic text, empty text,
negated intent and adversarial instructions scored 0.01–0.13. Retained the initial
0.5 threshold since it separated all nine examples. The function skips empty input
in code, although it is included here as a model probe.

This small synthetic set tests the rubric; it does not calibrate actual return
rates. Re-run with representative customer reasons when changing the rubric or
model. The production model is pinned to the resolved build shown above.
