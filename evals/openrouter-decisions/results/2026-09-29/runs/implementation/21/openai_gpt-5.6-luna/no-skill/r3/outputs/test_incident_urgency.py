import unittest

from incident_urgency import assess_urgency, rate_incident


class IncidentUrgencyTests(unittest.TestCase):
    def test_critical_service_outage_is_five(self):
        self.assertEqual(rate_incident("Checkout is down for all users", "checkout"), 5)

    def test_security_impact_is_five_even_on_noncritical_service(self):
        self.assertEqual(rate_incident("Customer tokens exposed", "reporting"), 5)

    def test_broad_degradation_is_four(self):
        self.assertEqual(rate_incident("Most customers see severe latency", "search"), 4)

    def test_partial_critical_service_impact_is_four(self):
        self.assertEqual(rate_incident("Some users get 5xx errors", "payments"), 4)

    def test_suspected_issue_is_two(self):
        self.assertEqual(rate_incident("Possible flaky behavior, investigating", "worker"), 2)

    def test_planned_work_is_one(self):
        self.assertEqual(rate_incident("Planned maintenance, no customer impact", "database"), 1)

    def test_assessment_includes_reasons(self):
        assessment = assess_urgency("Partial outage", "checkout")
        self.assertEqual(assessment.score, 4)
        self.assertIn("affected service is critical", assessment.reasons)


if __name__ == "__main__":
    unittest.main()
