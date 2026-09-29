# Incident urgency

A Python 3.10+ module with no third-party dependencies. Uses the native **Score**
primitive of the `typesafe/jev-1.13` decision model through OpenRouter's
`POST /api/v1/systemone` endpoint.

Set `OPENROUTER_API_KEY` in your environment, then run:

```sh
python incident_urgency.py --service checkout --report 'All production checkout requests fail; no workaround.'
```

Alternatively omit `--report` and pipe the text through stdin.
`INCIDENT_DECISION_MODEL` can select another model supporting native Score questions.

```python
from dataclasses import asdict
from incident_urgency import rate_incident

rating = rate_incident(
    report="All production checkout requests fail; no workaround.",
    service="checkout",
)
dashboard_record = asdict(rating)
# Store alongside the incident ID and original report in your application.
# Sort scored records by score descending; break equal scores by oldest first.
```

| Urgency | Meaning |
| --- | --- |
| 1 | Routine: no current functional impact or ongoing risk |
| 2 | Low: minor disruption with an effective workaround |
| 3 | Moderate: partial disruption, or active problem with unknown impact |
| 4 | High: major production impact requiring prompt response |
| 5 | Critical: widespread outage, active data loss, compromise, or safety risk |

The API's probability-weighted score is zero-based (0–4). The module adds one
to produce `score` (1–5) and rounds to the nearest integer for `urgency`, with
halves rounding upward. Keep the continuous `score` for dashboard sorting.
Returned probability keys are also shifted to 1–5. `confidence` is the model's
certainty, not a guarantee of correctness; retain it for human triage.

Empty or oversized inputs raise `ValueError` without sending a request. Model
failures, timeouts, and invalid responses raise `DecisionModelError`; keep these
incidents visible as **unscored / needs triage**. Do not substitute urgency 1.
The synchronous call has a 15-second timeout and makes one attempt; a background
worker can schedule bounded retries for temporary failures. The service name and
report are sent to OpenRouter. No incident text or API key is logged by the module.

Tune the rubric against your team's labeled incidents before relying on its
ranking. The prompt treats report text as data and handles negation and recovery,
but model decisions still need evaluation on real examples.

Run the offline contract and error-handling tests:

```sh
python -m unittest discover -s tests -v
```

API references: [System One](https://docs.typesafe.ai/api),
[Score semantics](https://docs.typesafe.ai/primitives/score),
[OpenRouter decision model catalog](https://openrouter.ai/api/v1/models?output_modalities=decisions).
