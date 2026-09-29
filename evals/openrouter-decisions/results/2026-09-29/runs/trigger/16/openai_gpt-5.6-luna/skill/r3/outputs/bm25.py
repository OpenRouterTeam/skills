"""BM25 ranking for already-tokenized documents."""

from __future__ import annotations

from collections import Counter
from math import log
from typing import Sequence


def rank_bm25(
    query: Sequence[str],
    documents: Sequence[Sequence[str]],
    *,
    top_k: int = 10,
    k1: float = 1.2,
    b: float = 0.75,
) -> list[Sequence[str]]:
    """Return the highest-scoring documents for a tokenized query.

    Documents are returned in their original form. Ties retain input order.
    Documents with no query-term matches are included if fewer than ``top_k``
    documents match.
    """
    if top_k < 0:
        raise ValueError("top_k must be non-negative")
    if k1 < 0:
        raise ValueError("k1 must be non-negative")
    if not 0 <= b <= 1:
        raise ValueError("b must be between 0 and 1")
    if top_k == 0 or not documents:
        return []

    document_count = len(documents)
    lengths = [len(document) for document in documents]
    average_length = sum(lengths) / document_count

    # Document frequency counts each document once, regardless of term count.
    document_frequency: Counter[str] = Counter()
    term_frequencies: list[Counter[str]] = []
    for document in documents:
        frequencies = Counter(document)
        term_frequencies.append(frequencies)
        document_frequency.update(frequencies.keys())

    scores: list[float] = []
    query_terms = set(query)
    for frequencies, document_length in zip(term_frequencies, lengths):
        score = 0.0
        for term in query_terms:
            frequency = frequencies.get(term, 0)
            if not frequency:
                continue
            df = document_frequency[term]
            # Robertson/Sparck Jones IDF with BM25's standard non-negative
            # smoothing. This also behaves sensibly for very common terms.
            idf = log(1.0 + (document_count - df + 0.5) / (df + 0.5))
            length_factor = 1.0 - b + b * document_length / average_length if average_length else 1.0
            score += idf * (frequency * (k1 + 1.0)) / (frequency + k1 * length_factor)
        scores.append(score)

    ranked_indexes = sorted(range(document_count), key=lambda index: (-scores[index], index))
    return [documents[index] for index in ranked_indexes[:top_k]]


__all__ = ["rank_bm25"]
