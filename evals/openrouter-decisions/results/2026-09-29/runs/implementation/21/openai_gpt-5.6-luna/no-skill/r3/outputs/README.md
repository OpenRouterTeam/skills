# Incident urgency model

`rate_incident(report, affected_service)` returns an integer from 1 to 5:

* 5 — data/security impact or a critical-service outage
* 4 — broad or severe impact
* 3 — partial or intermittent impact
* 2 — suspected or unconfirmed impact
* 1 — informational, planned, test, or no-impact report

For an auditable result, use `assess_urgency(...)`, which also returns the
matched reasons. The critical-service list can be supplied by the caller for
deployment-specific service ownership.

Run the tests with:

```sh
python -m unittest -v
```
