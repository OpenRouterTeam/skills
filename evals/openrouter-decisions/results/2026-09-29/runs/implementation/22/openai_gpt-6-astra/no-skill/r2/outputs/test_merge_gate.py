import io
import json
import unittest
from unittest.mock import patch
from urllib.error import URLError

import merge_gate


def response(probability):
    return {"answers": {"declares_breaking_change": {
        "type": "noul", "noul": probability,
    }}}


class MergeGateTests(unittest.TestCase):
    def test_policy_boundaries_and_request(self):
        for probability, allowed in [(0, True), (0.099, True), (0.1, False),
                                     (0.5, False), (0.99, False), (1, False)]:
            with self.subTest(probability=probability):
                with patch("merge_gate.urlopen", return_value=io.BytesIO(
                    json.dumps(response(probability)).encode()
                )) as call:
                    result = merge_gate.evaluate("PR description", "test-key")
                self.assertEqual(result["allow_auto_merge"], allowed)
                request = call.call_args.args[0]
                self.assertEqual(request.full_url, merge_gate.ENDPOINT)
                self.assertEqual(json.loads(request.data),
                                 merge_gate.build_request("PR description"))
                self.assertEqual(call.call_args.kwargs["timeout"], 30)

    def test_invalid_answers_rejected(self):
        for value in [True, False, None, "0.01", -0.1, 1.1,
                      float("nan"), float("inf")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                merge_gate.breaking_probability(response(value))
        for value in [{}, {"answers": {}}, {"answers": None},
                      {"answers": {"declares_breaking_change": {
                          "type": "choice", "noul": 0.01}}}]:
            with self.subTest(value=value), self.assertRaises((KeyError, TypeError, ValueError)):
                merge_gate.breaking_probability(value)

    def test_missing_input_or_key_does_not_call_api(self):
        with patch("merge_gate.urlopen") as call:
            for description, key in [("  ", "key"), ("text", None), ("text", "")]:
                with self.assertRaises(ValueError):
                    merge_gate.evaluate(description, key)
            call.assert_not_called()

    def test_cli_fails_closed_on_network_and_invalid_json(self):
        for error in [URLError("unavailable"), ValueError("bad JSON")]:
            with patch("merge_gate.Path.read_text", return_value="Description"), \
                 patch("merge_gate.evaluate", side_effect=error), \
                 patch("sys.stdout", new_callable=io.StringIO) as output:
                self.assertEqual(merge_gate.main(["pr.md"]), 2)
                self.assertFalse(json.loads(output.getvalue())["allow_auto_merge"])

    def test_preview_never_calls_api(self):
        with patch("merge_gate.Path.read_text", return_value="Breaking change"), \
             patch("merge_gate.urlopen") as call, \
             patch("sys.stdout", new_callable=io.StringIO) as output:
            self.assertEqual(merge_gate.main(["pr.md", "--show-request"]), 0)
            self.assertEqual(json.loads(output.getvalue()),
                             merge_gate.build_request("Breaking change"))
            call.assert_not_called()


if __name__ == "__main__":
    unittest.main()
