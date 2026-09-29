"""BM25 ranking for tokenized queries and documents; no dependencies required."""

from collections import Counter
from heapq import nlargest
from math import log1p
from typing import Sequence


def rank_search_results(
    query_tokens: Sequence[str],
    documents: Sequence[Sequence[str]],
) -> list[Sequence[str]]:
    """Return up to 10 original documents, ordered by descending BM25 score.

    Uses k1=1.5, b=0.75, and positive Robertson IDF. Corpus statistics
    come from all supplied documents. Tokens must already be normalized
    consistently. Repeated query tokens count once; ties keep input order.
    Zero-score documents are included when needed to fill the top 10.
    """
    if not documents:
        return []

    k1, b = 1.5, 0.75
    count = len(documents)
    average_length = sum(map(len, documents)) / count
    if not query_tokens or average_length == 0:
        return list(documents[:10])

    terms = set(query_tokens)
    frequencies = [Counter(token for token in doc if token in terms) for doc in documents]
    document_frequency = Counter(term for frequency in frequencies for term in frequency)
    idf = {
        term: log1p((count - frequency + 0.5) / (frequency + 0.5))
        for term, frequency in document_frequency.items()
    }

    def score(index: int) -> float:
        normalization = k1 * (1 - b + b * len(documents[index]) / average_length)
        return sum(
            idf[term] * frequency * (k1 + 1) / (frequency + normalization)
            for term, frequency in frequencies[index].items()
        )

    indices = nlargest(10, range(count), key=lambda index: (score(index), -index))
    return [documents[index] for index in indices]
