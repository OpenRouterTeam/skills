"""BM25 ranking for already-tokenized search data."""

from __future__ import annotations

from collections import Counter
from math import log
from typing import Hashable, Sequence, TypeVar


T = TypeVar("T")


def rank_search_results(
    query: Sequence[Hashable],
    documents: Sequence[Sequence[Hashable]],
    *,
    top_k: int = 10,
    k1: float = 1.2,
    b: float = 0.75,
) -> list[Sequence[Hashable]]:
    """Return the top ``top_k`` documents ranked with Okapi BM25.

    ``query`` and every document must already be tokenized.  The returned
    values are the original document objects, in descending score order.
    Equal scores retain their original input order.
    """
    if top_k <= 0 or not documents:
        return []
    if k1 < 0:
        raise ValueError("k1 must be non-negative")
    if not 0 <= b <= 1:
        raise ValueError("b must be between 0 and 1")

    query_terms = set(query)
    if not query_terms:
        return list(documents[:top_k])

    document_lengths = [len(document) for document in documents]
    average_length = sum(document_lengths) / len(documents)
    document_frequency = Counter(
        token for document in documents for token in set(document)
    )
    document_count = len(documents)

    scored = []
    for index, document in enumerate(documents):
        term_frequencies = Counter(document)
        length_factor = (
            1 - b + b * document_lengths[index] / average_length
            if average_length
            else 1
        )
        score = 0.0
        for term in query_terms:
            frequency = term_frequencies.get(term, 0)
            if not frequency:
                continue
            df = document_frequency[term]
            idf = log(1 + (document_count - df + 0.5) / (df + 0.5))
            score += idf * (frequency * (k1 + 1)) / (
                frequency + k1 * length_factor
            )
        scored.append((score, index, document))

    scored.sort(key=lambda item: (-item[0], item[1]))
    return [document for _, _, document in scored[:top_k]]


def rank_search_results_with_scores(
    query: Sequence[Hashable],
    documents: Sequence[Sequence[Hashable]],
    *,
    top_k: int = 10,
    k1: float = 1.2,
    b: float = 0.75,
) -> list[tuple[Sequence[Hashable], float]]:
    """Return ``(document, score)`` pairs using the same BM25 calculation."""
    ranked = rank_search_results(
        query, documents, top_k=top_k, k1=k1, b=b
    )
    return [(document, _bm25_score(query, document, documents, k1, b)) for document in ranked]


def _bm25_score(
    query: Sequence[Hashable],
    document: Sequence[Hashable],
    documents: Sequence[Sequence[Hashable]],
    k1: float,
    b: float,
) -> float:
    """Compute one document's score; kept private to avoid a second public API."""
    query_terms = set(query)
    lengths = [len(item) for item in documents]
    average_length = sum(lengths) / len(lengths) if lengths else 0
    dfs = Counter(token for item in documents for token in set(item))
    frequencies = Counter(document)
    factor = 1 - b + b * len(document) / average_length if average_length else 1
    total = 0.0
    for term in query_terms:
        frequency = frequencies.get(term, 0)
        if frequency:
            df = dfs[term]
            total += log(1 + (len(documents) - df + 0.5) / (df + 0.5)) * (
                frequency * (k1 + 1) / (frequency + k1 * factor)
            )
    return total


__all__ = ["rank_search_results", "rank_search_results_with_scores"]
