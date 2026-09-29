from bm25 import rank_bm25


def test_returns_top_ten_and_puts_best_match_first():
    documents = [["cat", "sat"]] + [["dog", str(index)] for index in range(11)]

    result = rank_bm25(["cat"], documents)

    assert len(result) == 10
    assert result[0] == ["cat", "sat"]


def test_document_frequency_and_term_frequency_affect_score():
    documents = [
        ["search", "search", "ranking"],
        ["search", "ranking", "other", "other", "other", "other"],
        ["unrelated"],
    ]

    result = rank_bm25(["search", "ranking"], documents)

    assert result[:2] == documents[:2]
    assert result[2] == documents[2]


def test_ties_are_stable_and_empty_documents_are_supported():
    documents = [[], ["other"], ["query"]]

    assert rank_bm25(["missing"], documents) == documents
    assert rank_bm25(["query"], documents)[0] == ["query"]

