# Incident Urgency Rating

`incident_urgency.py` turns a free-text incident report and affected service
name into a 1–5 urgency score for sorting an on-call dashboard.

## Scale

1. Informational / no customer impact
2. Low impact or minor degradation
3. Moderate, intermittent, or localized customer impact
4. Significant partial outage or critical workflow is broken
5. Complete outage, safety issue, active security breach, or severe data loss

## Usage

```python
from incident_urgency import rate_incident_report

rating = rate_incident_report(
    "Checkout is completely down; all users are affected.",
    "checkout",
)
print(rating.score)
```

The decision model is transparent and deterministic. It matches weighted text
signals, adjusts the score using service criticality, and clamps the result to
the 1–5 scale. Every returned rating includes the matched signals and rationale.

For production deployments, pass an explicit mapping when service names should
not be inferred:

```python
rating = rate_incident_report(
    "Elevated 5xx errors are affecting many users",
    "payments-api",
    service_criticality={"payments-api": 1.0},
)
```

## Tests

```bash
python -m pytest
```
