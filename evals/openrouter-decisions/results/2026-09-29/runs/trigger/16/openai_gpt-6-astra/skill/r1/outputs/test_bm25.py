import unittest

from bm25 import rank_search_results


class BM25Tests(unittest.TestCase):
    def test_term_frequency_and_length_normalization(self):
        unrelated = ["pear"]
        long_match = ["apple"] + ["pear"] * 20
        short_match = ["apple"]
        repeated_match = ["apple", "apple"]
        self.assertEqual(
            rank_search_results(
                ["apple"], [unrelated, long_match, short_match, repeated_match]
            ),
            [repeated_match, short_match, long_match, unrelated],
        )

    def test_rare_terms_have_more_weight(self):
        documents = [["common"], ["common"], ["rare"]]
        self.assertIs(rank_search_results(["common", "rare"], documents)[0], documents[2])

    def test_top_ten_and_stable_ties(self):
        documents = [[str(index)] for index in range(15)]
        self.assertEqual(rank_search_results(["missing"], documents), documents[:10])
        self.assertEqual(
            rank_search_results(["14"], documents), [documents[14]] + documents[:9]
        )

    def test_empty_inputs(self):
        self.assertEqual(rank_search_results(["apple"], []), [])
        self.assertEqual(rank_search_results(["apple"], [[], []]), [[], []])
        self.assertEqual(rank_search_results([], [["apple"], []]), [["apple"], []])


if __name__ == "__main__":
    unittest.main()
