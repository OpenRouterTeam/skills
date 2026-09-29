# support-ops-moderation_reviews-openai_gpt-5.6-luna-r3

Site: `src/moderation/reviews.ts`

Brief given to both authors:

> Replace the word lists and promo regexes in moderate() with a decision model, keeping the same flags and publish decision.

## Candidate B

### Design

```json
{
  "questions": {
    "profanity": {
      "type": "noul",
      "instructions": "Is the review content profane or vulgar? Judge the meaning of `review.title` and `review.body`, including abbreviations and profanity used in context. Do not flag ordinary criticism, quoted product names, or content that explicitly says profanity was not used.",
      "criteria": {
        "true": "The review contains profanity or vulgar language.",
        "false": "The review does not contain profanity or vulgar language."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Is the review content promotional or advertising? Judge `review.title` and `review.body`. Flag external links, discount or coupon offers, referral or promo codes, invitations to contact the reviewer privately for an offer, or content advertising the reviewer or another business. Do not flag ordinary product recommendations or a factual mention of a product or support channel.",
      "criteria": {
        "true": "The review contains promotional or advertising content.",
        "false": "The review does not contain promotional or advertising content."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Is the review content harassing or personally abusive? Judge `review.title` and `review.body`. Flag insults, degrading name-calling, or abusive attacks directed at a person or group. Do not flag criticism of a product, company, service, or experience that is not a personal attack.",
      "criteria": {
        "true": "The review contains harassment or personal abuse.",
        "false": "The review does not contain harassment or personal abuse."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { review: { title: input.title, body: input.body } };",
  "decide_js": "const FLAG_THRESHOLD = 0.5;\nconst flags = [];\nfunction flagged(name) {\n  const answer = answers[name];\n  return answer && answer.type === \"noul\" && typeof answer.noul === \"number\" && answer.noul >= FLAG_THRESHOLD;\n}\nif (flagged(\"profanity\")) flags.push(\"profanity\");\nif (flagged(\"promotional\")) flags.push(\"promotional\");\nif (flagged(\"harassment\")) flags.push(\"harassment\");\nif (typeof input.body !== \"string\" || input.body.trim().length < 12) flags.push(\"too_short\");\nreturn flags.length === 0 ? \"publish\" : \"hold\";",
  "notes": "The decision model independently judges whether the title and body contain profanity, promotional content, or harassment; it does not generate text or perform deterministic checks. JavaScript computes the existing too_short flag from the body length and preserves the existing flag order and publish rule. Each noul is treated as flagged at a probability threshold of 0.5; any malformed or missing model answer is conservatively treated as unflagged by this implementation, while any resulting flag causes hold."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "review": {
        "title": "Broke after a week",
        "body": "The strap snapped after seven days. Support was slow to respond. Would not buy again."
      }
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.02
      },
      "promotional": {
        "type": "noul",
        "noul": 0.01
      },
      "harassment": {
        "type": "noul",
        "noul": 0.02
      }
    },
    "action": "publish",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "review": {
        "title": "Great but cheaper elsewhere",
        "body": "Love it. If you want 20% off go to my page and message me for the code."
      }
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.02
      },
      "promotional": {
        "type": "noul",
        "noul": 0.98
      },
      "harassment": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "hold",
    "error": null
  }
]
```
