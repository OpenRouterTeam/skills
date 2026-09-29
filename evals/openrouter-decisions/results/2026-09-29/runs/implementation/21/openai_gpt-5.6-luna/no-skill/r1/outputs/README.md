# Incident urgency scorer

`rate_incident(report, service_name)` rates a free-text incident on a stable
1–5 scale and returns an `UrgencyRating` containing the score and explanations.

The decision model considers service criticality, availability, degradation,
customer/revenue impact, security or data impact, explicit severity language,
and mitigation. Security/data incidents and total outages are at least 4;
life-safety or catastrophic signals are 5.

```python
from incident_urgency import rate_incident

rating = rate_incident("Customers cannot check out; all regions are down", "payments")
print(rating.score)   # 5
print(rating.reasons)
```

Run tests with `python -m pytest`.
