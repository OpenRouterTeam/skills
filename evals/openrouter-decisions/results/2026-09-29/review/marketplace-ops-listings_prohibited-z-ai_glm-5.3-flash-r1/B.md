# marketplace-ops-listings_prohibited-z-ai_glm-5.3-flash-r1

Site: `src/listings/prohibited.ts`

Brief given to both authors:

> Replace the term lists in screenListing() so a listing is published, blocked when it offers a weapon or a counterfeit, or held when it appears to be a recalled product or the screen is unsure. Keep the strike rule.

## Candidate B

### Design

```json
{
  "questions": {
    "is_weapon": {
      "type": "noul",
      "instructions": "Does this listing offer a weapon for sale? Judge the item being offered. A weapon is an item designed or marketed to harm, injure, or incapacitate people, such as a firearm, ammunition, a fighting or combat blade, a stun gun or taser, a self-defense chemical spray, or an explosive. Kitchen, culinary, and household cutlery and tools, sporting goods, toys, and costume props are not weapons.",
      "criteria": {
        "true": "The item offered is a weapon: an item designed or marketed to harm, injure, or incapacitate people.",
        "false": "The item offered is an ordinary good not designed to harm people, such as kitchen or household cutlery, a tool, a sporting good, a toy, or a costume prop."
      }
    },
    "is_counterfeit": {
      "type": "noul",
      "instructions": "Is the product offered in this listing a counterfeit? A counterfeit is a copy, replica, knockoff, or unauthorized imitation of a branded product, or an item passed off as a brand-name good that shows signs it is not genuine, such as an implausibly low price for the brand, missing original packaging or papers on an item described as new, or replica code words such as 'aaa quality' or 'mirror quality'. An authentic item, a used authentic item, and an honestly described generic or unbranded good are not counterfeit.",
      "criteria": {
        "true": "The product is a counterfeit, replica, or unauthorized imitation of a branded product, or is presented as a brand-name good while showing signs it is not genuine.",
        "false": "The product is genuine, or is an honestly described good that does not imitate a specific brand."
      }
    },
    "is_recalled": {
      "type": "noul",
      "instructions": "Does this listing appear to offer a product that has been recalled, is subject to a safety notice, or is banned? Judge whether the item itself appears to be such a product, not whether recall-related words appear in the listing.",
      "criteria": {
        "true": "The item offered appears to be a recalled product, or a product under a safety notice or ban.",
        "false": "The item appears to be an ordinary product with no indication of a recall, safety notice, or ban."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.sellerStrikes >= 3) return null;\nreturn {\n  title: input.title,\n  description: input.description,\n  category: input.category\n};",
  "decide_js": "const BLOCK_T = 0.5;  // pre-probe default: weapon or counterfeit at/above -> block. Wrong block costs an appeal (most succeed); wrong publish puts a prohibited item on sale. Raise only from probe data.\nconst RECALL_T = 0.5; // pre-probe default: recalled at/above -> hold. 'Appears to be recalled' is a deliberately lower bar; a wrong hold is corrected by review.\nconst UNSURE_T = 0.3; // any answer at/above this but below its gate: the screen is unsure -> hold for review.\n\nif (input.sellerStrikes >= 3) return 'hold';\n\nfunction noulOf(key) {\n  const a = answers[key];\n  return a && a.type === 'noul' && typeof a.noul === 'number' ? a.noul : null;\n}\n\nconst weapon = noulOf('is_weapon');\nconst counterfeit = noulOf('is_counterfeit');\nconst recalled = noulOf('is_recalled');\n\n// Missing key or unexpected answer type fails closed to review, never to publish.\nif (weapon === null || counterfeit === null || recalled === null) return 'hold';\n\nif (weapon >= BLOCK_T || counterfeit >= BLOCK_T) return 'block';\nif (recalled >= RECALL_T) return 'hold';\nif (weapon >= UNSURE_T || counterfeit >= UNSURE_T || recalled >= UNSURE_T) return 'hold';\nreturn 'publish';",
  "notes": "The model judges three independent conditions over the listing's title, description, and category — is a weapon offered, is the product counterfeit, does it appear to be recalled or banned — as one noul each because the labels can co-occur (a replica taser is both), all in the single allowed request; the questions ask about the item, not the presence of trigger words, so 'not affected by the recall' and kitchen cutlery no longer trip substring matches. Code keeps everything deterministic: the strike rule (sellerStrikes >= 3) returns hold and skips the model by returning a null state, and decide_js applies the gates. Weapon and counterfeit block at BLOCK_T, recall holds at RECALL_T (a wrong hold is corrected by review, a wrong publish sells a dangerous item), and any answer in the unsure band [UNSURE_T, its gate) holds for review — that band is the screen's fallback and absorbs gray-zone items like hunting knives; missing or malformed answers also fail closed to hold. The shipped gates are the pre-probe defaults (0.5, unsure band from 0.3): before trusting them, run the probe set through decide.ts --compare across candidate models — kitchen knife set and butter knife (publish), an explicit firearm, taser, or pepper-spray listing (block), a 'replica' bag and 'authentic Nike Air Max, very cheap, no box' (block), a recalled crib model (hold), a negated recall statement (publish), and an adversarial gun listing dressed up as kitchenware (block) — then set each constant from the observed probabilities (clear cases typically land near 0.9+, which is what justifies raising BLOCK_T toward 0.8), pin the chosen canonical_slug in config rather than an alias, and log the response model string with every stored answer, since thresholds do not carry across models."
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
      "is_weapon": {
        "type": "noul",
        "noul": 0.02
      },
      "is_counterfeit": {
        "type": "noul",
        "noul": 0.04
      },
      "is_recalled": {
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
      "is_weapon": {
        "type": "noul",
        "noul": 0.01
      },
      "is_counterfeit": {
        "type": "noul",
        "noul": 0.99
      },
      "is_recalled": {
        "type": "noul",
        "noul": 0.09
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
      "is_weapon": {
        "type": "noul",
        "noul": 0.01
      },
      "is_counterfeit": {
        "type": "noul",
        "noul": 0.04
      },
      "is_recalled": {
        "type": "noul",
        "noul": 0.79
      }
    },
    "action": "hold",
    "error": null
  }
]
```
