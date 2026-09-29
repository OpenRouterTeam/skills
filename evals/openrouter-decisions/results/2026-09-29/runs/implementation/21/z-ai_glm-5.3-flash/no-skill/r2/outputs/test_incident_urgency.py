from incident_urgency import UrgencyRater, format_for_dashboard


def test_low_urgency_typo() -> None:
    decision = UrgencyRater().rate("Dashboard color is wrong", "Marketing site")
    assert decision.score == 1


def test_isolated_access_problem() -> None:
    decision = UrgencyRater().rate("One customer cannot log in", "Authentication")
    assert decision.score == 5


def test_partial_outage_on_noncritical_service() -> None:
    decision = UrgencyRater().rate("Some users report 500 errors", "Image resizer")
    assert 2 <= decision.score <= 4


def test_total_outage_and_critical_service_is_capped() -> None:
    decision = UrgencyRater().rate("Production is down for all users", "Checkout")
    assert decision.score == 5


def test_unavailable_critical_service() -> None:
    decision = UrgencyRater().rate("Payments are unavailable", "Payments")
    assert decision.score == 4


def test_security_report_gets_urgency() -> None:
    decision = UrgencyRater().rate("Possible unauthorized access to logs", "Observability")
    assert 3 <= decision.score <= 5


def test_custom_critical_service() -> None:
    rater = UrgencyRater(critical_services=["Dispatch Mesh"])
    decision = rater.rate("Latency is high", "Dispatch Mesh")
    assert decision.score >= 2
    assert "critical-service" in decision.matched_rules


def test_dashboard_formatter() -> None:
    decision = UrgencyRater().rate("Payment API is unavailable", "Payments")
    assert format_for_dashboard(decision).startswith("urgency=")
