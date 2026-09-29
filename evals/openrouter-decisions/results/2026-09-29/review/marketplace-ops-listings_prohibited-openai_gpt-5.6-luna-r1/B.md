# marketplace-ops-listings_prohibited-openai_gpt-5.6-luna-r1

Site: `src/listings/prohibited.ts`

Brief given to both authors:

> Replace the term lists in screenListing() so a listing is published, blocked when it offers a weapon or a counterfeit, or held when it appears to be a recalled product or the screen is unsure. Keep the strike rule.

## Candidate B

### Design

```json
{
  "questions": {
    "weapon": {
      "type": "noul",
      "instructions": "Does this listing clearly offer a weapon or weapon-like item for sale? Judge the actual product being offered, not incidental mentions, warnings, comparisons, accessories, or ordinary household tools such as kitchen knives and butter knives.",
      "criteria": {
        "true": "The listing clearly offers a weapon, ammunition, taser, pepper spray, or similar weapon-like item.",
        "false": "The listing does not clearly offer a weapon, including when the item is an ordinary household tool or the text merely mentions weapons."
      }
    },
    "counterfeit": {
      "type": "noul",
      "instructions": "Does this listing clearly appear to offer a counterfeit, replica, unauthorized imitation, or fake branded product? Consider the product description and suspicious authenticity claims, but do not treat merely low price or missing packaging as conclusive. If the evidence is ambiguous, reflect that uncertainty.",
      "criteria": {
        "true": "The listing clearly appears to be counterfeit, a replica, or an unauthorized imitation.",
        "false": "The listing appears authentic or there is no meaningful evidence that it is counterfeit."
      }
    },
    "recalled": {
      "type": "noul",
      "instructions": "Does this listing appear to offer a recalled product or a product covered by a safety notice or pre-sale ban? If the available information is ambiguous or insufficient to rule this out, reflect that uncertainty.",
      "criteria": {
        "true": "The listing clearly indicates that the product is recalled, subject to a safety notice, or prohibited from sale for safety reasons.",
        "false": "The listing does not appear to involve a recalled or safety-restricted product."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.sellerStrikes >= 3) return null;\nreturn {\n  title: input.title,\n  description: input.description,\n  category: input.category\n};",
  "decide_js": "if (input.sellerStrikes >= 3) return \"hold\";\n\nfunction probability(key) {\n  const answer = answers[key];\n  if (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\" || !Number.isFinite(answer.noul)) return null;\n  return answer.noul;\n}\n\nconst weapon = probability(\"weapon\");\nconst counterfeit = probability(\"counterfeit\");\nconst recalled = probability(\"recalled\");\nif (weapon === null || counterfeit === null || recalled === null) return \"hold\";\n\nif (weapon >= 0.8 || counterfeit >= 0.8) return \"block\";\nif (weapon > 0.2 || counterfeit > 0.2 || recalled > 0.2) return \"hold\";\nreturn \"publish\";",
  "notes": "The model classifies the actual listing context rather than matching terms, distinguishing ordinary household knives from weapons and assessing counterfeit and recall evidence. Seller strikes of three or more are held without a model request. A weapon or counterfeit probability of at least 0.8 blocks; any non-negligible uncertainty above 0.2 holds, as does any recall indication or uncertainty above 0.2; only clear negatives for all three publish."
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
        "noul": 0.06
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
        "noul": 0.96
      },
      "recalled": {
        "type": "noul",
        "noul": 0.08
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
        "noul": 0.75
      }
    },
    "action": "hold",
    "error": null
  }
]
```
