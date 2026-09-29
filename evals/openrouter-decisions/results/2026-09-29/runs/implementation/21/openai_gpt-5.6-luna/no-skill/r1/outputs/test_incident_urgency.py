import pytest

from incident_urgency import rate_incident


def test_empty_report_is_lowest_urgency():
    assert rate_incident("", "search").score == 1


def test_critical_service_and_customer_outage_is_high():
    result = rate_incident("All customers cannot log in; service is down", "auth")
    assert result.score == 4
    assert any("Broad availability" in reason for reason in result.reasons)


def test_security_incident_is_at_least_four():
    result = rate_incident("Possible credential leak affecting two accounts", "profile")
    assert result.score == 4


def test_degradation_is_less_urgent_than_outage():
    degraded = rate_incident("Elevated latency for a few requests", "search")
    outage = rate_incident("Widespread outage; customers cannot use search", "search")
    assert 1 <= degraded.score < outage.score <= 5


def test_mitigation_reduces_non_security_incident():
    result = rate_incident("Checkout outage resolved with a workaround", "checkout")
    assert result.score == 2
    assert any("Mitigation" in reason for reason in result.reasons)


def test_types_are_validated():
    with pytest.raises(TypeError):
        rate_incident(None, "search")
