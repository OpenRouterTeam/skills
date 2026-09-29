import pytest

from incident_urgency import rate_incident_report


def test_ratings_are_whole_numbers_within_scale():
    rating = rate_incident_report("Elevated 5xx errors are affecting many users", "payments-api")
    assert rating.score == 4
    assert 1 <= rating.score <= 5
    assert 0 <= rating.confidence <= 1


def test_informational_report_is_low_urgency():
    rating = rate_incident_report(
        "A disk is at 85%, but there is no customer impact. This is informational only.",
        "metrics-worker",
    )
    assert rating.score == 1


def test_intermittent_internal_issue_is_moderate():
    rating = rate_incident_report(
        "Internal dashboard has intermittent timeouts for a few users",
        "admin-dashboard",
    )
    assert rating.score == 2


def test_single_customer_auth_failure_is_elevated():
    rating = rate_incident_report("One customer cannot log in to their account", "auth")
    assert rating.score == 3


def test_complete_outage_scores_maximum():
    rating = rate_incident_report(
        "Payments are completely down; all users are affected.",
        "checkout",
    )
    assert rating.score == 5
    assert "complete_outage" in rating.signals


def test_explicit_service_criticality_is_required_when_mapping_is_supplied():
    with pytest.raises(ValueError):
        rate_incident_report("API is slow", "api", service_criticality={"payments": 1.0})


def test_invalid_service_criticality_is_rejected():
    with pytest.raises(ValueError):
        rate_incident_report("API is slow", "api", service_criticality={"api": 1.2})
