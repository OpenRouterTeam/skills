from incident_urgency import assess_incident, rate_incident


def test_security_incident_is_highest_priority():
    assert rate_incident("Customer data breach suspected", "api") == 5


def test_critical_service_outage_is_priority_four():
    assessment = assess_incident("Payments are completely down", "payments")
    assert assessment.score == 4
    assert "critical" in " ".join(assessment.reasons)


def test_customer_degradation_is_priority_three():
    assert rate_incident("Customers affected by elevated error rate", "search") == 3


def test_workaround_lowers_contained_issue_to_priority_two():
    assert rate_incident("Checkout errors, manual process is a workaround", "checkout") == 2


def test_informational_report_is_priority_one():
    assert rate_incident("Planned maintenance completed successfully", "search") == 1


def test_empty_input_is_safe_and_low_priority():
    assert rate_incident("", "") == 1
