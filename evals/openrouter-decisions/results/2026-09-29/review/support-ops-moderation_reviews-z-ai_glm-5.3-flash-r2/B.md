# support-ops-moderation_reviews-z-ai_glm-5.3-flash-r2

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
        "true": "The review text contains swear words, vulgar language, or crude expressions.",
        "false": "The review text contains no swear words or vulgar language."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Is this product review promotional in intent?",
      "criteria": {
        "true": "The review promotes something other than candid opinion about the product: it contains a link or URL, mentions a discount or promo code, tells readers to buy elsewhere or contact the author, or reads like an advertisement.",
        "false": "The review is a candid opinion about the product with no promotional intent."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Does this product review contain harassment or personal insults directed at people?",
      "criteria": {
        "true": "The review insults, demeans, or attacks a person or group of people.",
        "false": "The review criticizes only the product, the company, or the experience, and contains no insults directed at people."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const text = `${input.title} ${input.body}`;\nreturn {\n  review_text: text,\n  body_length: input.body.trim().length\n};",
  "decide_js": "const flags = [];\nconst T = 0.8;\nconst prof = answers.profanity;\nif (prof && prof.type === 'noul' && prof.noul >= T) flags.push('profanity');\nconst promo = answers.promotional;\nif (promo && promo.type === 'noul' && promo.noul >= T) flags.push('promotional');\nconst har = answers.harassment;\nif (har && har.type === 'noul' && har.noul >= T) flags.push('harassment');\nif (state && state.body_length < 12) flags.push('too_short');\nreturn flags.length === 0 ? 'publish' : 'hold';",
  "notes": "The model judges the three text-based flags as three independent noul questions over the combined title and body: profanity, promotional intent, and harassment. Code computes the too_short flag from body length (a deterministic check that stays out of the model) and applies the publish decision. The state carries only the review text and the body length; the length is read only by code, but it is derived from the same input and kept in state so decide_js can apply it without re-deriving. Thresholds: each noul gates at 0.8 (named constant T), chosen to be stricter than the 0.5 default pending step-8 probing; a miss on the low side means a borderline review publishes, which matches the original keyword lists' conservative behavior only loosely, so the probe set should cover clear profanity, clear promo links, insults aimed at the product rather than a person (should not flag harassment), negations like 'no complaints', and adversarial promo text. The final action is 'publish' when no flags are raised and 'hold' otherwise, matching the original flags.length === 0 rule."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "review_text": "Broke after a week The strap snapped after seven days. Support was slow to respond. Would not buy again.",
      "body_length": 85
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
      "review_text": "Great but cheaper elsewhere Love it. If you want 20% off go to my page and message me for the code.",
      "body_length": 71
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
