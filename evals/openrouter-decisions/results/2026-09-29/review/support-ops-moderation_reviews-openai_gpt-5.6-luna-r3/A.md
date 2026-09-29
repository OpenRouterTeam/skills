# support-ops-moderation_reviews-openai_gpt-5.6-luna-r3

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
      "instructions": "Does the review title or body contain profanity matching any of these exact standalone words: damn, hell, crap, wtf, or bs? Judge only the title and body, case-insensitively. A word counts when it is separated by non-word characters.",
      "criteria": {
        "true": "The title or body contains at least one of the listed profanity words as a standalone token.",
        "false": "The title and body contain none of the listed profanity words as standalone tokens."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Does the review title or body contain promotional content matching any of these patterns: an http or https URL; the phrase 'discount code'; the phrase 'use code' followed by at least four uppercase letters or digits; the phrase 'check out my'; or the phrase 'dm me'? Judge phrases case-insensitively except that the code characters after 'use code' must be uppercase letters or digits.",
      "criteria": {
        "true": "The title or body matches at least one of the specified promotional patterns.",
        "false": "The title and body match none of the specified promotional patterns."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Does the review title or body contain any of these harassment terms as a case-insensitive substring: idiot, stupid, moron, or loser?",
      "criteria": {
        "true": "The title or body contains at least one of the listed harassment terms, including as part of a longer word.",
        "false": "The title and body contain none of the listed harassment terms."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { review: input, text: String(input.title || '') + ' ' + String(input.body || '') };",
  "decide_js": "const answerFor = (key) => { const answer = answers[key]; if (!answer || answer.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)) throw new Error('Invalid Decisions answer for ' + key); return answer.noul >= 0.5; }; const flags = []; if (answerFor('profanity')) flags.push('profanity'); if (answerFor('promotional')) flags.push('promotional'); if (answerFor('harassment')) flags.push('harassment'); const body = String(input.body || ''); if (body.trim().length < 12) flags.push('too_short'); return flags.length === 0 ? 'publish' : 'hold';",
  "notes": "The decision model judges profanity, promotional content, and harassment in the review title and body using criteria corresponding to the original word lists and regexes. JavaScript computes the too_short flag exactly from the trimmed body length and publishes only when no flags are present. Each noul answer is treated as true at a probability threshold of 0.5; invalid or unexpected answer types throw an error."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "review": {
        "id": "R-1",
        "productId": "P-88",
        "rating": 2,
        "title": "Broke after a week",
        "body": "The strap snapped after seven days. Support was slow to respond. Would not buy again.",
        "verifiedPurchase": true
      },
      "text": "Broke after a week The strap snapped after seven days. Support was slow to respond. Would not buy again."
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.04
      },
      "promotional": {
        "type": "noul",
        "noul": 0.03
      },
      "harassment": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "publish",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "review": {
        "id": "R-2",
        "productId": "P-88",
        "rating": 5,
        "title": "Great but cheaper elsewhere",
        "body": "Love it. If you want 20% off go to my page and message me for the code.",
        "verifiedPurchase": false
      },
      "text": "Great but cheaper elsewhere Love it. If you want 20% off go to my page and message me for the code."
    },
    "answers": {
      "profanity": {
        "type": "noul",
        "noul": 0.04
      },
      "promotional": {
        "type": "noul",
        "noul": 0.14
      },
      "harassment": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "publish",
    "error": null
  }
]
```
