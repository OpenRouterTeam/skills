import io
import json
import unittest
from datetime import date
from unittest.mock import Mock, patch

from subscription import OpenRouterDecisionModel, is_long_term_customer_likely_to_return


class SubscriptionTests(unittest.TestCase):
    def test_age_gate_skips_model_until_after_anniversary(self):
        model = Mock(return_value=True)
        for today in (date(2025, 9, 29), date(2026, 9, 28), date(2026, 9, 29)):
            with self.subTest(today=today):
                self.assertFalse(is_long_term_customer_likely_to_return(
                    date(2025, 9, 29), "I'll return next month",
                    today=today, decision_model=model,
                ))
        model.assert_not_called()
        self.assertTrue(is_long_term_customer_likely_to_return(
            date(2025, 9, 29), "I'll return next month",
            today=date(2026, 9, 30), decision_model=model,
        ))
        model.assert_called_once_with("I'll return next month")

    def test_leap_day_anniversary(self):
        for today, expected in ((date(2025, 2, 28), False), (date(2025, 3, 1), True)):
            with self.subTest(today=today):
                self.assertEqual(is_long_term_customer_likely_to_return(
                    date(2024, 2, 29), "Back after my trip",
                    today=today, decision_model=Mock(return_value=True),
                ), expected)

    def test_blank_reason_skips_model(self):
        model = Mock()
        self.assertFalse(is_long_term_customer_likely_to_return(
            date(2020, 1, 1), "  ", today=date(2026, 1, 1), decision_model=model,
        ))
        model.assert_not_called()

    def test_future_start_rejected(self):
        model = Mock()
        with self.assertRaises(ValueError):
            is_long_term_customer_likely_to_return(
                date(2027, 1, 1), "Returning soon",
                today=date(2026, 1, 1), decision_model=model,
            )
        model.assert_not_called()

    def test_negative_model_decision(self):
        self.assertFalse(is_long_term_customer_likely_to_return(
            date(2020, 1, 1), "Leaving permanently",
            today=date(2026, 1, 1), decision_model=Mock(return_value=False),
        ))

    def test_model_failures_and_non_boolean_results_are_not_negative_decisions(self):
        for model, error in (
            (Mock(side_effect=TimeoutError), TimeoutError),
            (Mock(return_value="false"), TypeError),
        ):
            with self.subTest(error=error), self.assertRaises(error):
                is_long_term_customer_likely_to_return(
                    date(2020, 1, 1), "Returning soon",
                    today=date(2026, 1, 1), decision_model=model,
                )


class OpenRouterTests(unittest.TestCase):
    def call_with_content(self, content):
        response = io.BytesIO(json.dumps({
            "choices": [{"message": {"content": content}}]
        }).encode())
        model = OpenRouterDecisionModel("test-model", api_key="test-key")
        with patch("subscription.urlopen", return_value=response) as send:
            result = model("I'll return after summer")
        return result, send

    def test_structured_decision_and_request(self):
        for expected in (True, False):
            result, send = self.call_with_content(json.dumps({"likely_to_return": expected}))
            self.assertIs(result, expected)
            request = send.call_args.args[0]
            payload = json.loads(request.data)
            self.assertEqual(payload["model"], "test-model")
            self.assertEqual(payload["messages"][0]["role"], "system")
            self.assertEqual(json.loads(payload["messages"][1]["content"]), {
                "cancellation_reason": "I'll return after summer"
            })
            self.assertTrue(payload["response_format"]["json_schema"]["strict"])
            self.assertEqual(send.call_args.kwargs["timeout"], 30)

    def test_invalid_model_output_rejected(self):
        for content in ('{"likely_to_return":"false"}', '{}', 'true', 'not json',
                        '{"likely_to_return":true,"extra":1}', None):
            with self.subTest(content=content), self.assertRaises(ValueError):
                self.call_with_content(content)


if __name__ == "__main__":
    unittest.main()
