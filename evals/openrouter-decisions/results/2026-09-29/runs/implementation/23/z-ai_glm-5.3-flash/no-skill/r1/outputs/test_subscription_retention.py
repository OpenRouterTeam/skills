from datetime import date

from subscription_retention import RetentionDecision, Subscription, should_target_for_return


def test_recent_subscription_is_not_scored():
    subscription = Subscription(date(2024, 9, 1), "temporary need")
    assert should_target_for_return(subscription, date(2025, 8, 31)) == RetentionDecision.TOO_NEW


def test_positive_reason_after_one_year_is_likely():
    subscription = Subscription(date(2024, 9, 1), "temporary need while switching jobs")
    assert should_target_for_return(subscription, date(2025, 9, 1)) == RetentionDecision.RETURN_LIKELY


def test_dissatisfaction_is_unlikely():
    subscription = Subscription(date(2024, 9, 1), "poor support and a broken feature")
    assert should_target_for_return(subscription, date(2025, 9, 1)) == RetentionDecision.RETURN_UNLIKELY


def test_missing_reason_is_reported():
    subscription = Subscription(date(2024, 9, 1), None)
    assert should_target_for_return(subscription, date(2025, 9, 1)) == RetentionDecision.NO_REASON_PROVIDED
