import math
import unittest

from bm25 import rank_bm25


class BM25Tests(unittest.TestCase):
    def test_scores_match_hand_calculation(self):
        # N=3, df(cat)=2, average length=2, k1=1.5, b=0.75.
        results = rank_bm25(["cat"], [["cat", "cat"], ["cat", "dog"], ["dog", "dog"]])
        idf = math.log(1 + 1.5 / 2.5)
        self.assertEqual([index for index, _ in results], [0, 1, 2])
        self.assertAlmostEqual(results[0][1], idf * 5 / 3.5)
        self.assertAlmostEqual(results[1][1], idf)
        self.assertEqual(results[2][1], 0.0)

    def test_shorter_document_ranks_higher_for_equal_term_frequency(self):
        results = rank_bm25(["cat"], [["cat", "dog", "dog"], ["cat"], []])
        self.assertEqual([index for index, _ in results], [1, 0, 2])

    def test_top_ten_and_stable_ties(self):
        documents = [["cat"] for _ in range(12)]
        results = rank_bm25(["cat"], documents)
        self.assertEqual([index for index, _ in results], list(range(10)))

    def test_no_matches(self):
        self.assertEqual(rank_bm25(["cat"], [["dog"], []]), [(0, 0.0), (1, 0.0)])

    def test_empty_inputs(self):
        self.assertEqual(rank_bm25([], [["cat"]]), [])
        self.assertEqual(rank_bm25(["cat"], []), [])
        self.assertEqual(rank_bm25(["cat"], [[], []]), [(0, 0.0), (1, 0.0)])


if __name__ == "__main__":
    unittest.main()
