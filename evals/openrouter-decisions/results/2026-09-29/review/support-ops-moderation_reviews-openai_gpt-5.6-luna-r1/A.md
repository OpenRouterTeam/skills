# support-ops-moderation_reviews-openai_gpt-5.6-luna-r1

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
      "instructions": "Does the review title or body contain profanity, vulgar language, or a vulgar abbreviation?",
      "criteria": {
        "true": "The review contains profanity or vulgar abbreviations such as damn, hell, crap, wtf, or bs.",
        "false": "The review contains no profanity or vulgar language."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Does the review contain promotional or solicitation content?",
      "criteria": {
        "true": "The review promotes something or solicits engagement, including a URL, discount code, instructions to use a code, an invitation to check out the author's offering, or a request to send a direct message.",
        "false": "The review is not promotional and contains no solicitation."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Does the review contain harassment or an insulting personal attack?",
      "criteria": {
        "true": "The review uses insulting or abusive language toward a person, including terms such as idiot, stupid, moron, or loser.",
        "false": "The review contains no harassment or insulting personal attack."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { title: input.title, body: input.body, rating: input.rating, verifiedPurchase: input.verifiedPurchase };",
  "decide_js": "function readFlag(key) { const answer = answers[key]; if (!answer || answer.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)) throw new Error('Invalid noul answer for ' + key); return answer.noul >= 0.5; } const flags = []; if (readFlag('profanity')) flags.push('profanity'); if (readFlag('promotional')) flags.push('promotional'); if (readFlag('harassment')) flags.push('harassment'); if (typeof input.body !== 'string') throw new Error('Invalid review body'); if (input.body.trim().length < 12) flags.push('too_short'); return flags.length === 0 ? 'publish' : 'hold';",
  "notes": "The decision model judges profanity, promotional content, and harassment in the review title and body. JavaScript preserves the original too_short rule by checking whether the trimmed body has fewer than 12 characters, preserves the flag order, requires each model answer to be a noul answer, and treats a noul value of at least 0.5 as flagged. Any flag results in hold; otherwise the action is publish."
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
      "verifiedPurchase": true
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
      "verifiedPurchase": false
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.03
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
