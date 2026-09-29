# marketplace-ops-listings_prohibited-openai_gpt-5.6-luna-r2

Site: `src/listings/prohibited.ts`

Brief given to both authors:

> Replace the term lists in screenListing() so a listing is published, blocked when it offers a weapon or a counterfeit, or held when it appears to be a recalled product or the screen is unsure. Keep the strike rule.

## Candidate B

### Design

```json
{
  "questions": {
    "offers_weapon": {
      "type": "noul",
      "instructions": "Does this listing offer a weapon or an item primarily intended to injure, incapacitate, or function as a weapon? Judge the product being offered, not merely whether the text contains a weapon-related word. Ordinary household tools such as kitchen knives, butter knives, and gardening tools are not weapons unless the listing presents them as weapons.",
      "criteria": {
        "true": "The listing offers a weapon or weapon-purpose item.",
        "false": "The listing does not offer a weapon; ordinary household or utility tools do not count."
      }
    },
    "offers_counterfeit": {
      "type": "noul",
      "instructions": "Does this listing appear to offer counterfeit, fake, or unauthorized branded goods? Consider the product claims and suspicious authenticity signals in the listing, while treating an ordinary unbranded product as non-counterfeit.",
      "criteria": {
        "true": "The listing appears to offer counterfeit or unauthorized branded goods.",
        "false": "The listing does not appear counterfeit, or it is an ordinary unbranded product without a branded authenticity concern."
      }
    },
    "appears_recalled": {
      "type": "noul",
      "instructions": "Does this listing appear to concern a product subject to a recall, safety notice, or similar product-safety withdrawal? Infer this from the listing context; do not treat an unrelated use of safety language as a recall.",
      "criteria": {
        "true": "The listing appears to concern a recalled or safety-withdrawn product.",
        "false": "The listing does not appear to concern a recalled or safety-withdrawn product."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { title: String(input.title || ''), description: String(input.description || ''), category: String(input.category || '') };",
  "decide_js": "if (Number(input.sellerStrikes) >= 3) return 'hold';\nfunction probability(key) {\n  const answer = answers && answers[key];\n  if (!answer || answer.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)) return null;\n  return answer.noul;\n}\nconst weapon = probability('offers_weapon');\nconst counterfeit = probability('offers_counterfeit');\nconst recalled = probability('appears_recalled');\nif (weapon === null || counterfeit === null || recalled === null) return 'hold';\nconst uncertain = (p) => p > 0.35 && p < 0.65;\nif (uncertain(weapon) || uncertain(counterfeit) || uncertain(recalled)) return 'hold';\nif (weapon >= 0.65 || counterfeit >= 0.65) return 'block';\nif (recalled >= 0.5) return 'hold';\nreturn 'publish';",
  "notes": "The decision model judges whether the product being offered is a weapon, appears counterfeit, or appears recalled; it is explicitly told not to rely on literal term matching, so ordinary kitchen knives can publish while suspicious branded goods can be blocked. Code keeps the seller-strike rule, treats probabilities between 0.35 and 0.65 as uncertain and holds them, blocks clear weapon or counterfeit judgments at >= 0.65, and holds a clear recalled judgment at >= 0.5. Missing or malformed answers also hold conservatively."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "title": "Kitchen knife set, 5 pieces",
      "description": "Stainless steel chef knives with a wooden block. Sharp and well balanced, dishwasher safe.",
      "category": "home"
    },
    "answers": {
      "offers_weapon": {
        "type": "noul",
        "noul": 0.02
      },
      "offers_counterfeit": {
        "type": "noul",
        "noul": 0.03
      },
      "appears_recalled": {
        "type": "noul",
        "noul": 0.04
      }
    },
    "action": "publish",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "title": "Nike Air Max 90 - mirror quality, no box",
      "description": "Look exactly like the originals, nobody will notice the difference. Very cheap, all sizes available.",
      "category": "shoes"
    },
    "answers": {
      "offers_weapon": {
        "type": "noul",
        "noul": 0.01
      },
      "offers_counterfeit": {
        "type": "noul",
        "noul": 0.98
      },
      "appears_recalled": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "block",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "title": "Baby sleeper rocker, gently used",
      "description": "Inclined sleeper, the kind that was in the news last year. Works fine, we just don't need it anymore.",
      "category": "baby"
    },
    "answers": {
      "offers_weapon": {
        "type": "noul",
        "noul": 0.02
      },
      "offers_counterfeit": {
        "type": "noul",
        "noul": 0.04
      },
      "appears_recalled": {
        "type": "noul",
        "noul": 0.79
      }
    },
    "action": "hold",
    "error": null
  }
]
```
