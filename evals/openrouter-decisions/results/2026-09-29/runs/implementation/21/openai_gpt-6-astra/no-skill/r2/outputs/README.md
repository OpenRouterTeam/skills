# Incident urgency rating

A Python 3.10+ module and CLI that send free-text incident reports and affected
service names to a configurable decision model through OpenRouter. No third-party
packages are required.

| Urgency | Meaning |
| --- | --- |
| 5 | Critical: widespread/core outage, ongoing data loss, active compromise, immediate safety risk |
| 4 | High: significant customer impact, major partial outage, severe degradation |
| 3 | Medium: limited impact with a workaround, or a plausible incident with unclear impact |
| 2 | Low: minor degradation or isolated noncritical issue |
| 1 | Informational: no active impact, resolved incident, or test |

Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in your environment. Use the exact
OpenRouter identifier for your chosen decision model; it must support structured
outputs (`response_format` with `json_schema`). Model selection is required, so
there is no implicit model or provider fallback that ignores this requirement.

```bash
export OPENROUTER_API_KEY='your-api-key'
export OPENROUTER_MODEL='your-provider/your-decision-model'
printf '%s' 'Checkout fails for all customers; no payments succeed.' \
  | python incident_urgency.py --service checkout
```

Example output (the score is determined by the model):

```json
{"service": "checkout", "urgency": 5}
```

Application integration:

```python
from incident_urgency import RatingError, UrgencyRater

rater = UrgencyRater.from_env()
urgency = rater.rate(report="Elevated error rates in one region", service="search")
# Store urgency on the incident; sort the dashboard by urgency descending.
```

`rate()` returns an integer from 1 through 5. Invalid input raises `ValueError`.
Timeouts, HTTP failures, refusals, truncated output, and invalid model ratings
raise `RatingError`. The CLI writes errors to stderr and exits with status 1.
Route these failures to a visible unscored/review queue; do not treat a failed
classification as low urgency. Reports are limited to 20,000 characters and
service names to 200, with no silent truncation.

Reports and service names are sent to the configured external model. They are
encoded as untrusted data, and the prompt instructs the model to ignore embedded
instructions. These measures do not guarantee correct classification. Validate
the chosen model against representative, labeled incidents before using scores
to determine on-call response; retain an operator override. The service name is
context only, not a service-criticality registry.

Run the offline API-contract and failure-handling tests:

```bash
python -m unittest discover -s tests -v
```

These tests mock model responses; they do not establish model classification accuracy.
