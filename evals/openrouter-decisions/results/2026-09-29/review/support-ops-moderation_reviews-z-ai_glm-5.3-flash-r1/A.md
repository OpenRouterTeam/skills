# support-ops-moderation_reviews-z-ai_glm-5.3-flash-r1

Site: `src/moderation/reviews.ts`

Brief given to both authors:

> Replace the word lists and promo regexes in moderate() with a decision model, keeping the same flags and publish decision.

## Candidate A

### Design

```json
{
  "questions": {
    "profanity": {
      "type": "noul",
      "instructions": "Does the review text contain profanity or vulgar language?",
      "criteria": {
        "true": "The text contains swear words or vulgar expressions such as damn, hell, crap, wtf, bs, or stronger language.",
        "false": "The text contains no profanity or vulgar language."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Is the review primarily promotional or does it contain promotional content?",
      "criteria": {
        "true": "The text contains links/URLs, discount or promo codes, calls to check out the author's own content, or solicitations to contact them privately (e.g. 'dm me').",
        "false": "The text is a genuine opinion about the product with no advertising, links, or codes."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Does the review contain harassment or personal attacks?",
      "criteria": {
        "true": "The text insults or attacks people (e.g. calling someone idiot, stupid, moron, loser) or is abusive toward other users or staff.",
        "false": "The text criticizes the product or company without personal insults or abuse."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const text = `${input.title} ${input.body}`;\nreturn {\n  title: input.title,\n  body: input.body,\n  rating: input.rating,\n  verifiedPurchase: input.verifiedPurchase,\n  bodyLength: input.body.trim().length\n};",
  "decide_js": "const flags = [];\nfor (const q of ['profanity', 'promotional', 'harassment']) {\n  const a = answers[q];\n  if (!a || a.type !== 'noul' || typeof a.noul !== 'number') throw new Error('missing or unexpected answer for ' + q);\n  if (a.noul > 0.5) flags.push(q);\n}\nif (state.bodyLength < 12) flags.push('too_short');\nreturn flags.length === 0 ? 'publish' : 'hold';",
  "notes": "The model judges the three subjective flags (profanity, promotional, harassment) as noul questions over the title+body text; the deterministic too_short check (body under 12 trimmed chars) stays in code, matching the original threshold. decide_js validates each answer's type before reading noul, flags at the 0.5 threshold, and publishes only when no flags are present, preserving the original publish/hold semantics. The old word lists and regexes are fully replaced; the model generalizes beyond them (e.g. catches profanity or promo patterns not on the original lists)."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "title": "Broke after a week",
      "body": "The strap snapped after seven days. Support was slow to respond. Would not buy again.",
      "rating": 2,
      "verifiedPurchase": true,
      "bodyLength": 85
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.03
      },
      "promotional": {
        "type": "noul",
        "noul": 0.02
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
      "title": "Great but cheaper elsewhere",
      "body": "Love it. If you want 20% off go to my page and message me for the code.",
      "rating": 5,
      "verifiedPurchase": false,
      "bodyLength": 71
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
        "noul": 0.02
      }
    },
    "action": "hold",
    "error": null
  }
]
```
