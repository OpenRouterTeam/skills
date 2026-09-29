# marketplace-ops-listings_prohibited-openai_gpt-5.6-luna-r3

Site: `src/listings/prohibited.ts`

Brief given to both authors:

> Replace the term lists in screenListing() so a listing is published, blocked when it offers a weapon or a counterfeit, or held when it appears to be a recalled product or the screen is unsure. Keep the strike rule.

## Candidate A

### Design

```json
{
  "questions": {
    "disposition": {
      "type": "choice",
      "instructions": "Classify the listing's final moderation disposition. Judge what the listing appears to offer, not merely whether a word is mentioned. Ordinary household tools such as kitchen knives, chef knives, and butter knives are not weapons for this decision unless the listing presents them as weapons or for harmful use. Consider the title, description, and category together.",
      "criteria": {
        "publish": "The listing does not appear to offer a weapon or counterfeit goods, and there is no credible indication that the product is recalled. Normal household tools, legitimate branded goods, and ordinary product descriptions belong here.",
        "block": "The listing appears to offer a weapon, including a firearm, ammunition, taser, pepper spray, or a weapon marketed for harmful use; or it appears to offer counterfeit, fake, unauthorized, or knowingly imitation branded goods.",
        "hold": "The listing appears to concern a recalled product or safety notice, or the available information is ambiguous or insufficient to confidently distinguish publish from block."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input && input.sellerStrikes >= 3) return null;\nreturn {\n  title: input.title,\n  description: input.description,\n  category: input.category\n};",
  "decide_js": "if (input && input.sellerStrikes >= 3) return \"hold\";\nconst answer = answers && answers.disposition;\nif (!answer || answer.type !== \"choice\") return \"hold\";\nif (answer.choice === \"hold\") return \"hold\";\nif (answer.choice !== \"publish\" && answer.choice !== \"block\") return \"hold\";\nlet certainty = null;\nif (typeof answer.confidence === \"number\" && Number.isFinite(answer.confidence)) {\n  certainty = answer.confidence;\n} else if (answer.probabilities && typeof answer.probabilities === \"object\") {\n  const value = answer.probabilities[answer.choice];\n  if (typeof value === \"number\" && Number.isFinite(value)) certainty = value;\n}\nif (certainty === null || certainty < 0.75) return \"hold\";\nreturn answer.choice;",
  "notes": "The model judges the listing semantically, distinguishing actual weapons and counterfeit goods from ordinary household tools or legitimate branded products, and identifies credible recall or safety-notice situations. Code preserves the existing rule that sellers with at least three strikes are held without a model request; otherwise it uses the model's disposition, requiring at least 0.75 confidence (or matching choice probability) for publish or block and holding on missing, invalid, or insufficient certainty."
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
      "disposition": {
        "type": "choice",
        "choice": "publish",
        "probabilities": {
          "hold": 0,
          "publish": 1,
          "block": 0
        },
        "confidence": 1
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
      "disposition": {
        "type": "choice",
        "choice": "block",
        "probabilities": {
          "block": 1,
          "hold": 0,
          "publish": 0
        },
        "confidence": 1
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
      "disposition": {
        "type": "choice",
        "choice": "hold",
        "probabilities": {
          "publish": 0.13,
          "block": 0,
          "hold": 0.87
        },
        "confidence": 0.8
      }
    },
    "action": "hold",
    "error": null
  }
]
```
