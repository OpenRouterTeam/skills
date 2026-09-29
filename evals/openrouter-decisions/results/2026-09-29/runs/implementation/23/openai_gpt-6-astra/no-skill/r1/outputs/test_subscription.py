import json
import unittest
from datetime import date
from io import BytesIO
from unittest.mock import Mock, patch

from subscription import assess_subscription, openrouter_decision


class SubscriptionTests(unittest.TestCase):
    def test_anniversary_boundary_skips_model(self):
        model = Mock()
        for as_of in (date(2025, 6, 14), date(2025, 6, 15)):
            result = assess_subscription(
                date(2024, 6, 15), "I'll be back", as_of=as_of, decision_model=model
            )
            self.assertFalse(result.more_than_one_year_old)
            self.assertIsNone(result.return_intent)
        model.assert_not_called()

    def test_older_subscription_uses_model(self):
        for intent in ("likely", "unlikely", "unclear"):
            model = Mock(return_value=intent)
            result = assess_subscription(
                date(2024, 6, 15), "Taking a break", as_of=date(2025, 6, 16),
                decision_model=model,
            )
            self.assertTrue(result.more_than_one_year_old)
            self.assertEqual(result.return_intent, intent)
            model.assert_called_once_with("Taking a break")

    def test_leap_day_anniversary(self):
        for day, expected in ((date(2025, 2, 28), False), (date(2025, 3, 1), True)):
            result = assess_subscription(date(2024, 2, 29), "", as_of=day)
            self.assertEqual(result.more_than_one_year_old, expected)

    def test_blank_reason_skips_model(self):
        model = Mock()
        result = assess_subscription(
            date(2020, 1, 1), "  ", as_of=date(2025, 1, 1), decision_model=model
        )
        self.assertEqual(result.return_intent, "unclear")
        model.assert_not_called()

    def test_future_start_rejected(self):
        with self.assertRaises(ValueError):
            assess_subscription(date(2026, 1, 1), "", as_of=date(2025, 1, 1))

    def test_invalid_model_output_rejected(self):
        with self.assertRaises(ValueError):
            assess_subscription(
                date(2020, 1, 1), "reason", as_of=date(2025, 1, 1),
                decision_model=Mock(return_value="maybe"),
            )

    def test_model_failure_propagates(self):
        with self.assertRaises(TimeoutError):
            assess_subscription(
                date(2020, 1, 1), "reason", as_of=date(2025, 1, 1),
                decision_model=Mock(side_effect=TimeoutError),
            )

    @patch.dict("os.environ", {"OPENROUTER_API_KEY": "test", "OPENROUTER_MODEL": "test-model"})
    @patch("subscription.urlopen")
    def test_openrouter_request_and_validation(self, urlopen):
        for output in ({"return_intent": "likely"}, {"return_intent": "maybe"}, {}):
            response = {"choices": [{"message": {"content": json.dumps(output)}}]}
            urlopen.return_value = BytesIO(json.dumps(response).encode())
            if output == {"return_intent": "likely"}:
                self.assertEqual(openrouter_decision("I'll return next month"), "likely")
            else:
                with self.assertRaises(ValueError):
                    openrouter_decision("I'll return next month")
        request = urlopen.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(payload["messages"][1]["content"], "I'll return next month")
        self.assertEqual(payload["response_format"]["type"], "json_schema")
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 30)


if __name__ == "__main__":
    unittest.main()
