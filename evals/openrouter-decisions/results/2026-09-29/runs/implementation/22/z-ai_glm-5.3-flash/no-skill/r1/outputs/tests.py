from gate import build_question, classify_pr, decide_auto_merge


def test_breaking_blocks_auto_merge():
    classification = classify_pr(
        "Change endpoint shape",
        "BREAKING CHANGE: callers must update clients.",
        lambda _question: '{"decision":"breaking","evidence":"BREAKING CHANGE"}',
    )
    assert decide_auto_merge(classification) is False


def test_nonbreaking_allows_auto_merge():
    classification = classify_pr(
        "Fix docs",
        "Updates installation instructions.",
        lambda _question: '{"decision":"non-breaking","evidence":"No contract change"}',
    )
    assert decide_auto_merge(classification) is True


def test_question_contains_description():
    question = build_question("Title", "Adds an optional field.")
    assert "PR title: Title" in question
    assert "Adds an optional field." in question


if __name__ == "__main__":
    test_breaking_blocks_auto_merge()
    test_nonbreaking_allows_auto_merge()
    test_question_contains_description()
    print("3 tests passed")
