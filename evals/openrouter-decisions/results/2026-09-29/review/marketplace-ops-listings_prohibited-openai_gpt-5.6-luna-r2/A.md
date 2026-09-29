# marketplace-ops-listings_prohibited-openai_gpt-5.6-luna-r2

Site: `src/listings/prohibited.ts`

Brief given to both authors:

> Replace the term lists in screenListing() so a listing is published, blocked when it offers a weapon or a counterfeit, or held when it appears to be a recalled product or the screen is unsure. Keep the strike rule.

## Candidate A

### Design

```json
{
  "questions": {
    "weapon": {
      "type": "noul",
      "instructions": "Does this listing offer a weapon? Judge the product being sold, not merely words appearing in a description, and do not classify ordinary kitchen or household tools such as chef knives or butter knives as weapons unless the listing clearly presents them for use as weapons.",
      "criteria": {
        "true": "The product offered is a weapon, such as a firearm, ammunition, combat knife, or other weapon intended for harming or defense.",
        "false": "The product is an ordinary household item, tool, accessory, or other non-weapon."
      }
    },
    "counterfeit": {
      "type": "noul",
      "instructions": "Does this listing appear to offer a counterfeit or unauthorized imitation of a branded product?",
      "criteria": {
        "true": "The listing indicates the product is fake, counterfeit, unauthorized, or an imitation, including suspicious claims that strongly imply it is not authentic.",
        "false": "The product appears authentic, or the available information is insufficient to conclude that it is counterfeit."
      }
    },
    "recalled": {
      "type": "noul",
      "instructions": "Does this listing appear to offer a product that has been recalled or is covered by a safety notice?",
      "criteria": {
        "true": "The listing explicitly or strongly indicates that the product is recalled, subject to a safety notice, or otherwise unsafe under a known recall.",
        "false": "There is no meaningful indication that the product is recalled or subject to a safety notice."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.sellerStrikes >= 3) return null;\nreturn {\n  title: input.title,\n  description: input.description,\n  category: input.category\n};",
  "decide_js": "if (input.sellerStrikes >= 3) return \"hold\";\n\nfunction probability(answer) {\n  if (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return null;\n  return answer.noul;\n}\n\nvar weapon = probability(answers.weapon);\nvar counterfeit = probability(answers.counterfeit);\nvar recalled = probability(answers.recalled);\nif (weapon === null || counterfeit === null || recalled === null) return \"hold\";\n\nif (weapon >= 0.8 || counterfeit >= 0.8) return \"block\";\nif (recalled >= 0.8) return \"hold\";\nif ((weapon > 0.2 && weapon < 0.8) || (counterfeit > 0.2 && counterfeit < 0.8) || (recalled > 0.2 && recalled < 0.8)) return \"hold\";\nreturn \"publish\";",
  "notes": "The model judges whether the actual offered product is a weapon, counterfeit, or recalled product, with criteria that distinguish ordinary kitchen tools from weapons and suspicious authenticity claims from ordinary low prices. The code preserves the three-strike hold rule, blocks a clear weapon or counterfeit determination at probability 0.8 or higher, holds a clear recall, and holds whenever any screening probability is ambiguous between 0.2 and 0.8 or an answer is malformed or missing; otherwise it publishes."
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
      "weapon": {
        "type": "noul",
        "noul": 0.02
      },
      "counterfeit": {
        "type": "noul",
        "noul": 0.04
      },
      "recalled": {
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
      "title": "Nike Air Max 90 - mirror quality, no box",
      "description": "Look exactly like the originals, nobody will notice the difference. Very cheap, all sizes available.",
      "category": "shoes"
    },
    "answers": {
      "weapon": {
        "type": "noul",
        "noul": 0.01
      },
      "counterfeit": {
        "type": "noul",
        "noul": 0.98
      },
      "recalled": {
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
      "weapon": {
        "type": "noul",
        "noul": 0.01
      },
      "counterfeit": {
        "type": "noul",
        "noul": 0.04
      },
      "recalled": {
        "type": "noul",
        "noul": 0.73
      }
    },
    "action": "hold",
    "error": null
  }
]
```
