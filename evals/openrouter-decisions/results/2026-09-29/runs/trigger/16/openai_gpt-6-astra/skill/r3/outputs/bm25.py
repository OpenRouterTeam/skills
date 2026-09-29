"""BM25 ranking for pre-tokenized documents, using only the standard library."""

from collections import Counter
from heapq import nsmallest
from math import log1p
from typing import Sequence


def rank_bm25(
    query_tokens: Sequence[str], documents: Sequence[Sequence[str]]
) -> list[tuple[int, float]]:
    """Return up to 10 (document_index, score) pairs, highest score first.

    Query tokens must use the same normalization as document tokens. Each
    distinct query term contributes once. Uses k1=1.5, b=0.75 and positive
    Robertson IDF: log(1 + (N - df + 0.5) / (df + 0.5)).

    Ties retain input order; zero-score documents can fill remaining slots.
    An empty query or document collection returns an empty list.
    """
    if not query_tokens or not documents:
        return []

    query_terms = tuple(dict.fromkeys(query_tokens))
    term_counts = [Counter(document) for document in documents]
    document_frequency: Counter[str] = Counter()
    for counts in term_counts:
        document_frequency.update(counts.keys())

    count = len(documents)
    average_length = sum(map(len, documents)) / count
    if average_length == 0:
        return [(index, 0.0) for index in range(min(10, count))]

    idf = {
        term: log1p(
            (count - document_frequency[term] + 0.5)
            / (document_frequency[term] + 0.5)
        )
        for term in query_terms
    }
    k1, b = 1.5, 0.75

    def score(index: int) -> float:
        counts = term_counts[index]
        normalization = k1 * (1 - b + b * len(documents[index]) / average_length)
        return sum(
            idf[term] * frequency * (k1 + 1) / (frequency + normalization)
            for term in query_terms
            if (frequency := counts[term])
        )

    return nsmallest(
        10,
        ((index, score(index)) for index in range(count)),
        key=lambda result: (-result[1], result[0]),
    )
