"""BM25 ranking for already-tokenized documents and queries."""

from collections import Counter
from collections.abc import Sequence
from heapq import nlargest
from math import log1p


def bm25_top10(
    query_tokens: Sequence[str],
    documents: Sequence[Sequence[str]],
) -> list[tuple[int, float]]:
    """Return up to 10 (document index, score) pairs, highest score first.

    Use the same tokenization and normalization for the query and documents.
    Equal scores retain input order; zero-score documents remain eligible.
    Repeated query tokens contribute once per occurrence.
    """
    if not documents:
        return []

    k1, b = 1.5, 0.75
    query_counts = Counter(query_tokens)
    term_counts = [Counter(document) for document in documents]
    document_frequencies: Counter[str] = Counter()
    for counts in term_counts:
        document_frequencies.update(query_counts.keys() & counts.keys())

    count = len(documents)
    average_length = sum(map(len, documents)) / count
    if not query_counts or average_length == 0:
        return [(index, 0.0) for index in range(min(10, count))]

    idf = {
        term: log1p((count - frequency + 0.5) / (frequency + 0.5))
        for term, frequency in document_frequencies.items()
    }

    def score(index: int) -> float:
        normalization = k1 * (1 - b + b * len(documents[index]) / average_length)
        counts = term_counts[index]
        return sum(
            query_counts[term]
            * idf[term]
            * (counts[term] * (k1 + 1))
            / (counts[term] + normalization)
            for term in idf
            if counts[term]
        )

    return nlargest(
        10,
        ((index, score(index)) for index in range(count)),
        key=lambda result: (result[1], -result[0]),
    )
