# support-ops-moderation_reviews-z-ai_glm-5.3-flash-r3

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
      "instructions": "Does the review text contain profanity or vulgar swear words?",
      "criteria": {
        "true": "The text contains swearing or crude expletives such as damn, hell, crap, wtf, bs, or similar vulgar language.",
        "false": "The text contains no profanity or vulgar language."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Is the review promotional spam rather than genuine feedback?",
      "criteria": {
        "true": "The text promotes something external: it links to a website (http/https URL), advertises a discount or coupon ('discount code', 'use code XYZ'), directs readers elsewhere ('check out my ...'), solicits private contact ('dm me'), or reads like marketing copy for another product/service.",
        "false": "The text is ordinary customer feedback about the purchased product with no links, codes, solicitations, or advertising."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Does the review contain insulting or harassing language aimed at any person or group?",
      "criteria": {
        "true": "The text calls someone (staff, sellers, other users, groups) derogatory names such as idiot, stupid, moron, loser, or otherwise verbally abuses or demeans a person.",
        "false": "Any negative wording targets the product itself (quality, design, performance) rather than attacking a person."
      }
    }
  },
  "build_questions_js": "",
  "build_state_js": "return {\n  text: ((input.title || '') + ' ' + (input.body || '')).replace(/\\s+/g, ' ').trim(),\n  rating: input.rating,\n  verified_purchase: !!input.verifiedPurchase,\n  body_char_count: (typeof input.body === 'string' ? input.body.trim().length : 0)\n};",
  "decide_js": "function noulOf(key) {\n  var a = answers[key];\n  if (!a || typeof a !== 'object' || a.type !== 'noul' || typeof a.noul !== 'number') return null;\n  return a.noul;\n}\n\nvar profanityScore = noulOf('profanity');\nvar promoScore = noulOf('promotional');\nvar harassmentScore = noulOf('harassment');\n\nif (profanityScore === null || promoScore === null || harassmentScore === null) {\n  // Missing or mistyped answer: fail closed.\n  return 'hold';\n}\n\nvar flags = [];\nif (profanityScore >= 0.5) flags.push('profanity');\nif (promoScore >= 0.5) flags.push('promotional');\nif (harassmentScore >= 0.5) flags.push('harassment');\nif (state && typeof state.body_char_count === 'number' && state.body_char_count < 12) flags.push('too_short');\n\nreturn flags.length === 0 ? 'publish' : 'hold';",
  "notes": "Three noul questions replace the hardcoded word lists and promo regexes: profanity (swear words anywhere in title+body), promotional (links, discount/coupon codes, 'check out my'/'dm me' style solicitation, or ad-like copy), and harassment (insults or abuse directed at a person, mirroring the old substring matcher which fired even when negativity targeted non-person entities). Each flag fires when its noul probability is >= 0.5; the deterministic too_short rule (trimmed body shorter than 12 characters) stays local using body_char_count computed in build_state_js, along with the concatenated review text, rating, and verification status supplied as state. If any answer is missing or has an unexpected type, decide_js fails closed and holds instead of guessing. Publish requires zero flags, matching the original logic; any flag yields hold."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "text": "Broke after a week The strap snapped after seven days. Support was slow to respond. Would not buy again.",
      "rating": 2,
      "verified_purchase": true,
      "body_char_count": 85
    },
    "answers": {},
    "action": null,
    "error": "build_questions_js returned null, not an object"
  },
  {
    "skipped_model": false,
    "state": {
      "text": "Great but cheaper elsewhere Love it. If you want 20% off go to my page and message me for the code.",
      "rating": 5,
      "verified_purchase": false,
      "body_char_count": 71
    },
    "answers": {},
    "action": null,
    "error": "build_questions_js returned null, not an object"
  }
]
```
