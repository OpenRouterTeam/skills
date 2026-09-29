State should carry only the review text — the banned-word list is a code-side rule, not model state. Here’s the request and the replacement filter logic.

**Request**

```json
{
  "model": "<pinned-decision-model-canonical-slug>",
  "state": {
    "review": "<the review text>"
  },
  "questions": {
    "is_toxic": {
      "type": "noul",
      "instructions": "Is this review toxic? Judge the author's actual stance toward the product or people described, not isolated keyword matches. Statements of frustration, disappointment, or fair criticism are not toxic by themselves.",
      "criteria": {
        "true": "The review contains insulting, dehumanizing, threatening, or maliciously deceptive content, or targets a person or group with abuse.",
        "false": "The review is civil criticism, a complaint, a warning about a bad experience, or a neutral statement, even when it uses words like 'kill', 'scam', or 'idiot' figuratively or in context."
      }
    }
  }
}
```

**Gate logic**

```python
TOXICITY_THRESHOLD = 0.75  # step 8: probe clear toxic, ambiguous, negated, figurative cases

def is_toxic(review: str) -> bool:
    if not review.strip():
        return False
    answer = decide({"review": review}, is_toxic_question)
    assert answer.type == "noul"
    return answer.noul >= TOXICITY_THRESHOLD
```

Key changes:
- Single `noul` — one independent condition, one gate.
- Model sees only `review`; the banned list and any flags stay out of `state`.
- Figurative/negated uses ("killed my appetite", "this was a scam of a great product") get judged, not substring-matched.
- Threshold is a named constant, tuned after step 8 probes; empty input short-circuits in code.