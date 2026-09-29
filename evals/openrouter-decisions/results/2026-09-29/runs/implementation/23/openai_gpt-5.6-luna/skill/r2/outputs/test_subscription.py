import asyncio
from datetime import date
import unittest

from subscription import subscription_is_old_and_customer_may_return


class SubscriptionTest(unittest.TestCase):
    def test_younger_subscription_does_not_call_model(self):
        calls = []

        async def decide(request):
            calls.append(request)
            return {"answers": {"may_return": {"type": "noul", "noul": 1}}}

        result = asyncio.run(subscription_is_old_and_customer_may_return(
            {"subscription_started_at": "2025-09-29", "cancellation_reason": "Taking a break"},
            as_of=date(2026, 9, 29),
            decide=decide,
        ))
        self.assertFalse(result)
        self.assertEqual(calls, [])

    def test_old_subscription_uses_decision_probability(self):
        seen = []

        async def decide(request):
            seen.append(request)
            return {"answers": {"may_return": {"type": "noul", "noul": 0.8}}}

        result = asyncio.run(subscription_is_old_and_customer_may_return(
            {"subscription_started_at": "2024-09-29", "cancellation_reason": "Too expensive for now"},
            as_of=date(2026, 9, 29),
            decide=decide,
        ))
        self.assertTrue(result)
        self.assertEqual(seen[0]["model"], "typesafe/jev-1.13-20260917")

    def test_exact_anniversary_is_not_more_than_one_year(self):
        async def fail_if_called(request):
            raise AssertionError("model should not be called")

        result = asyncio.run(subscription_is_old_and_customer_may_return(
            {"subscription_started_at": "2025-02-28", "cancellation_reason": "Traveling"},
            as_of=date(2026, 2, 28),
            decide=fail_if_called,
        ))
        self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
