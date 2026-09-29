import unittest
from datetime import date

from subscription import should_target_win_back


class ShouldTargetWinBackTests(unittest.TestCase):
    AS_OF = date(2025, 6, 15)

    def test_requires_more_than_one_year(self):
        self.assertFalse(
            should_target_win_back("2024-06-15", "travel", as_of=self.AS_OF)
        )
        self.assertTrue(
            should_target_win_back("2024-06-14", "travel", as_of=self.AS_OF)
        )

    def test_reason_must_suggest_return(self):
        self.assertTrue(
            should_target_win_back("2023-01-01", "Taking a break", as_of=self.AS_OF)
        )
        self.assertFalse(
            should_target_win_back("2023-01-01", "Service was permanently unsuitable", as_of=self.AS_OF)
        )
        self.assertFalse(
            should_target_win_back("2023-01-01", "not coming back", as_of=self.AS_OF)
        )

    def test_leap_day_anniversary(self):
        self.assertFalse(
            should_target_win_back("2024-02-29", "temporary", as_of="2025-02-28")
        )
        self.assertTrue(
            should_target_win_back("2024-02-29", "temporary", as_of="2025-03-01")
        )


if __name__ == "__main__":
    unittest.main()
