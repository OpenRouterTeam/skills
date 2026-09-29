from datetime import date

import pytest

from subscription_retention import is_likely_to_return


AS_OF = date(2025, 1, 1)


@pytest.mark.parametrize(
    "started, reason, expected",
    [
        (date(2023, 12, 31), "Taking a break", True),
        (date(2023, 12, 31), "Too expensive right now", True),
        (date(2023, 12, 31), "No longer interested", False),
        (date(2023, 12, 31), "", False),
        (date(2024, 1, 2), "Taking a break", False),  # exactly 365 days
        (date(2024, 1, 3), "Taking a break", False),  # less than one year
    ],
)
def test_win_back_decision(started, reason, expected):
    assert is_likely_to_return(started, reason, as_of=AS_OF) is expected


def test_accepts_iso_dates_and_datetimes():
    assert is_likely_to_return("2023-01-01", "seasonal", as_of="2025-01-01")


def test_rejects_invalid_date():
    with pytest.raises(ValueError):
        is_likely_to_return("01/01/2023", "temporary", as_of=AS_OF)
