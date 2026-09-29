import io
import json
import unittest
from datetime import date
from unittest.mock import Mock, patch

from subscription import SubscriptionDecision, check_subscription, decide_return_intent


class SubscriptionTests(unittest.TestCase):
    def test_age_gate_is_strict_and_skips_model(self):
        model = Mock()
        for today in (date(2025, 9, 28), date(2025, 9, 29)):
            with self.subTest(today=today):
                self.assertEqual(
                    check_subscription(date(2024, 9, 29), "I'll return", today=today,
                                       decision_model=model),
                    SubscriptionDecision(False, None),
                )
        model.assert_not_called()

    def test_older_subscription_uses_decision_model(self):
        for intent in ("likely", "unlikely", "unclear"):
            model = Mock(return_value=intent)
            result = check_subscription(
                date(2024, 9, 29), " Back next summer. ",
                today=date(2025, 9, 30), decision_model=model,
            )
            self.assertEqual(result, SubscriptionDecision(True, intent))
            model.assert_called_once_with("Back next summer.")

    def test_leap_day_anniversary(self):
        model = Mock(return_value="likely")
        for today, expected in ((date(2025, 2, 28), False), (date(2025, 3, 1), True)):
            result = check_subscription(date(2024, 2, 29), "I'll return", today=today,
                                        decision_model=model)
            self.assertEqual(result.more_than_one_year, expected)
        self.assertEqual(model.call_count, 1)

    def test_blank_reason_is_unclear_without_model(self):
        model = Mock()
        self.assertEqual(
            check_subscription(date(2020, 1, 1), "  ", today=date(2026, 1, 1),
                               decision_model=model),
            SubscriptionDecision(True, "unclear"),
        )
        model.assert_not_called()

    def test_future_start_is_rejected(self):
        with self.assertRaises(ValueError):
            check_subscription(date(2027, 1, 1), "", today=date(2026, 1, 1))

    def test_invalid_model_decision_is_rejected(self):
        with self.assertRaises(ValueError):
            check_subscription(date(2020, 1, 1), "Reason", today=date(2026, 1, 1),
                               decision_model=lambda _: "maybe")

    @patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"})
    @patch("subscription.urlopen")
    def test_openrouter_structured_decision(self, urlopen):
        envelope = {"choices": [{"message": {"content": '{"return_intent":"likely"}'}}]}
        urlopen.return_value = io.BytesIO(json.dumps(envelope).encode())
        self.assertEqual(decide_return_intent("Back next month"), "likely")
        request = urlopen.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(payload["response_format"]["type"], "json_schema")
        self.assertEqual(json.loads(payload["messages"][1]["content"]),
                         {"cancellation_reason": "Back next month"})

    @patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"})
    @patch("subscription.urlopen")
    def test_malformed_model_response_is_rejected(self, urlopen):
        for content in ('{"return_intent":"maybe"}', '[]', 'not json'):
            envelope = {"choices": [{"message": {"content": content}}]}
            urlopen.return_value = io.BytesIO(json.dumps(envelope).encode())
            with self.subTest(content=content), self.assertRaises(ValueError):
                decide_return_intent("Reason")

    def test_model_failure_propagates(self):
        with self.assertRaises(TimeoutError):
            check_subscription(date(2020, 1, 1), "Reason", today=date(2026, 1, 1),
                               decision_model=Mock(side_effect=TimeoutError))


if __name__ == "__main__":
    unittest.main()
