# Incident urgency

A dependency-free Python 3.10+ client that sends an affected service name and
free-text incident report to an OpenRouter decision model. The result contains
the service and an integer urgency suitable for sorting descending:

| Urgency | Meaning |
| --- | --- |
| 5 | Critical: severe immediate impact, widespread outage, active compromise or data loss |
| 4 | High: major outage or degradation blocking core workflows |
| 3 | Moderate: partial outage, meaningful degradation, or unclear impact |
| 2 | Low: limited noncritical impact or effective workaround |
| 1 | Informational: no current impact or explicitly resolved |

## Run

Select a decision model available in your OpenRouter account that supports
`response_format: json_schema` with strict structured outputs and `temperature`.
The model ID is required so deployment explicitly controls model selection.
Reports and service names are sent to OpenRouter and its selected model provider.

```sh
export OPENROUTER_API_KEY='your-api-key'
export OPENROUTER_MODEL='your-provider/your-decision-model'
echo '{"service":"checkout","report":"All payments fail; no workaround."}' | python incident_urgency.py
```

Example output (the actual score is model-dependent):

```json
{"service": "checkout", "urgency": 4}
```

## Dashboard integration

```python
from dataclasses import asdict
from incident_urgency import UrgencyRater

rater = UrgencyRater.from_env()
rating = rater.rate(service="checkout", report="All payments fail; no workaround.")
dashboard_row = asdict(rating)  # {"service": "checkout", "urgency": 4}
# Persist urgency with your incident ID; sort dashboard rows by urgency descending.
```

Rate reports in an ingestion worker rather than during dashboard rendering.
Catch `RatingError` for provider/network errors, refusals, or malformed responses;
leave those reports unrated and visibly flag them for review or retry. Do not
convert failures to urgency 1 or silently hide unrated reports. Invalid input or
configuration raises `ValueError`. The CLI writes errors to stderr and exits 1.

The rubric treats both input fields as untrusted data and distinguishes ongoing
impact from historical, negated, hypothetical, or resolved symptoms. Strict output
validation guarantees a valid integer on success; it does not guarantee correct
incident severity judgments or immunity to prompt injection.
Calibrate the chosen model against labeled incidents from your services before
relying on its rankings. No live-model accuracy evaluation is included.

## Tests

```sh
python -m unittest discover -s tests -v
```

Tests use mocked provider responses to check the request contract, input and
output validation, failure behavior, and CLI. They need no credentials or network.
