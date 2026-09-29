# support-ops-moderation_reviews-openai_gpt-5.6-luna-r2

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
      "instructions": "Does this product review contain profanity or vulgar language?",
      "criteria": {
        "true": "The title or body contains profanity, vulgarity, or an equivalent expression, including terms such as damn, hell, crap, wtf, or bs.",
        "false": "The title and body contain no profanity or vulgar language."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Is this product review promotional or attempting to advertise, solicit, or redirect readers?",
      "criteria": {
        "true": "The review contains a URL, discount or promo code, an invitation to use a code, an invitation to check out the author's own offering, or an invitation to contact the author privately such as 'DM me'.",
        "false": "The review is an ordinary product review and does not advertise, solicit, or redirect readers."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Does this product review contain harassment, insults, or abusive language directed at a person or group?",
      "criteria": {
        "true": "The review uses insulting or abusive language such as idiot, stupid, moron, or loser, or an equivalent personal attack.",
        "false": "The review contains no personal insults, harassment, or abusive attacks."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { title: input.title, body: input.body, text: String(input.title || '') + ' ' + String(input.body || '') };",
  "decide_js": "const ids = ['profanity', 'promotional', 'harassment'];\nconst flags = [];\nfor (const id of ids) {\n  const answer = answers[id];\n  if (!answer || answer.type !== 'noul' || typeof answer.noul !== 'number') throw new Error('Invalid or missing ' + id + ' decision');\n  if (answer.noul >= 0.5) flags.push(id);\n}\nif (typeof input.body !== 'string') throw new Error('Invalid review body');\nif (input.body.trim().length < 12) flags.push('too_short');\nreturn flags.length === 0 ? 'publish' : 'hold';",
  "notes": "The decision model judges profanity, promotional content, and harassment, replacing the former word lists and promotional regular expressions. Code computes the too_short flag exactly as before using the trimmed body length, treats each noul probability of at least 0.5 as a positive flag, and returns publish only when no flags are present; otherwise it returns hold."
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
      "text": "Broke after a week The strap snapped after seven days. Support was slow to respond. Would not buy again."
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.03
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
      "title": "Great but cheaper elsewhere",
      "body": "Love it. If you want 20% off go to my page and message me for the code.",
      "text": "Great but cheaper elsewhere Love it. If you want 20% off go to my page and message me for the code."
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.02
      },
      "promotional": {
        "type": "noul",
        "noul": 0.99
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
