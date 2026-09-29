import pytest

from incident_urgency import rate_incident


def test_full_outage_on_payments_is_critical():
    rating = rate_incident(
        "All users are affected; payments are completely unusable.",
        "payments",
    )
    assert rating.urgency == 5
    assert rating.score >= 11


def test_intermittent_web_errors_are_high():
    rating = rate_incident(
        "Some users see intermittent errors in production.",
        "web",
    )
    assert rating.urgency == 4


def test_limited_internal_issue_is_low():
    rating = rate_incident(
        "A single non-blocking warning is visible on one page.",
        "internal",
    )
    assert rating.urgency == 1


def test_degradation_is_medium_with_time_context():
    rating = rate_incident(
        "Search has increased latency since 30 minutes for limited traffic.",
        "search",
    )
    assert rating.urgency == 3


@pytest.mark.parametrize(("report", "service"), [("", "api"), ("ok", " ")])
def test_empty_inputs_are_rejected(report, service):
    with pytest.raises(ValueError):
        rate_incident(report, service)
