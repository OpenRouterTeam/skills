from datetime import date, datetime

from subscription import check_old_subscription_return_risk


def test_recent_subscription_is_not_evaluated():
    decision = check_old_subscription_return_risk(date(2025, 12, 1), "price", today=date(2026, 9, 29))
    assert decision.is_more_than_one_year_old is False
    assert decision.may_return is None


def test_old_return_signal():
    decision = check_old_subscription_return_risk(
        datetime(2024, 1, 1), "It was too expensive.", today=date(2026, 9, 29)
    )
    assert decision.is_more_than_one_year_old is True
    assert decision.may_return is True


def test_old_negative_signal():
    decision = check_old_subscription_return_risk(
        date(2024, 1, 1), "Switched to a competitor.", today=date(2026, 9, 29)
    )
    assert decision.is_more_than_one_year_old is True
    assert decision.may_return is False


def test_old_unknown_signal_is_none():
    decision = check_old_subscription_return_risk(
        date(2024, 1, 1), "Family member changed plans.", today=date(2026, 9, 29)
    )
    assert decision.is_more_than_one_year_old is True
    assert decision.may_return is None
