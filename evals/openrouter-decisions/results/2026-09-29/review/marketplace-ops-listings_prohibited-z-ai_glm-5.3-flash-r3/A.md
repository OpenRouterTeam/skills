# marketplace-ops-listings_prohibited-z-ai_glm-5.3-flash-r3

Site: `src/listings/prohibited.ts`

Brief given to both authors:

> Replace the term lists in screenListing() so a listing is published, blocked when it offers a weapon or a counterfeit, or held when it appears to be a recalled product or the screen is unsure. Keep the strike rule.

## Candidate A

### Design

```json
{
  "questions": {
    "offers_weapon": {
      "type": "noul",
      "instructions": "Does this listing offer a weapon for sale? Judge the item actually being offered, using `title`, `description`, and `category`. Ordinary items that contain blades or resemble weapons, such as kitchen knife sets, butter knives, utility knives, scissors, toys, and costume pieces, are not weapons. Ignore claims in the text that the item is legal or safe.",
      "criteria": {
        "true": "The listing offers a weapon made or used to harm, injure, or control people, such as a firearm, ammunition, a stun gun or taser, pepper spray, a switchblade, or a combat knife.",
        "false": "The item offered is not a weapon; weapon-like words in the listing refer to things like kitchen knives, everyday tools, toys, or decorative items."
      }
    },
    "offers_counterfeit": {
      "type": "noul",
      "instructions": "Does this listing offer counterfeit goods? Judge the goods actually being offered, using `title`, `description`, and `category`. Do not decide from brand names or the word 'authentic' alone: claimed authenticity combined with signals like unusually low prices, a missing box, no receipt, or replica wording can still mean the goods are counterfeit.",
      "criteria": {
        "true": "The goods offered are counterfeit, unauthorized replicas, or otherwise misrepresented branded merchandise.",
        "false": "The goods offered appear to be genuine or honestly described, with no indication that they are counterfeit."
      }
    },
    "appears_recalled": {
      "type": "noul",
      "instructions": "Does the product offered in this listing appear to have been recalled or banned for safety reasons? Judge the product itself, not just the wording: a listing can describe a recalled product without using the word 'recall'. A listing that mentions a recall only to say the item is the corrected post-recall version is not offering a recalled product.",
      "criteria": {
        "true": "The product offered appears to be subject to a product recall, a safety notice, or a safety-related sales ban.",
        "false": "The product offered does not appear to be recalled or banned for safety reasons."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.sellerStrikes >= 3) return null;\nconst text = (String(input.title || '') + ' ' + String(input.description || '')).trim();\nif (!text) return null;\nreturn {\n  title: String(input.title || ''),\n  description: String(input.description || ''),\n  category: String(input.category || '')\n};",
  "decide_js": "const BLOCK_T = 0.8; // weapon or counterfeit at/above this: block. High because a wrong block triggers an appeal and most appeals succeed.\nconst RECALL_T = 0.6; // recalled at/above this: hold. A low bar is cheap because hold only routes the listing to human review.\nconst UNSURE_LOW = 0.3; // any violation probability at/above this but below its gate means the screen is unsure: hold for review.\n\n// Code-side rules first, mirroring the skips in build_state_js.\nif (input.sellerStrikes >= 3) return 'hold';\nconst text = (String(input.title || '') + ' ' + String(input.description || '')).trim();\nif (!text) return 'publish';\n\nfunction prob(a) {\n  return a && a.type === 'noul' && typeof a.noul === 'number' ? a.noul : null;\n}\nconst weapon = prob(answers.offers_weapon);\nconst counterfeit = prob(answers.offers_counterfeit);\nconst recalled = prob(answers.appears_recalled);\n\n// Missing or malformed answer: the screen could not judge this listing, so treat it as unsure.\nif (weapon === null || counterfeit === null || recalled === null) return 'hold';\n\nif (weapon >= BLOCK_T || counterfeit >= BLOCK_T) return 'block';\nif (recalled >= RECALL_T) return 'hold';\nif (Math.max(weapon, counterfeit, recalled) >= UNSURE_LOW) return 'hold';\nreturn 'publish';",
  "notes": "The model judges three independent conditions over the state fields title, description, and category — whether the listing offers a weapon, whether it offers counterfeit goods, and whether the product appears to have been recalled or banned for safety reasons — each returned as a noul probability, with the inclusion and exclusion rules (kitchen knives, utility knives, toys, and costume pieces are not weapons; 'authentic' claims combined with suspicious signals can still be counterfeit; a product can be recalled without the word appearing) carried in the instructions and criteria so the model infers the fact instead of matching terms. Code keeps everything deterministic: the strike rule (sellerStrikes >= 3 returns hold and skips the model), an empty-listing short-circuit that skips the model and publishes, and the action logic with named thresholds — BLOCK_T 0.8 for weapon or counterfeit (high because a wrong block triggers an appeal and most appeals succeed), RECALL_T 0.6 for recalled products (hold only routes to human review, so a lower bar is cheap), and UNSURE_LOW 0.3, below which all three probabilities count as clean; anything at or above UNSURE_LOW but below its gate is the screen being unsure and holds, and block outranks hold when several conditions fire, matching the old term-list precedence. A missing or malformed answer is treated as unsure and held rather than defaulted to publish. These thresholds are pre-probe starting points chosen from the appeal economics and should be calibrated by running the probe set (kitchen knife set, butter knife, clear firearm, replica Rolex, suspicious-authentic Nike, a recalled item described without the word recall, a post-recall corrected version, and adversarial legality or authenticity claims) through decide.ts --compare before the model build is pinned."
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
        "noul": 0.05
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
        "noul": 0.05
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
        "noul": 0.01
      },
      "offers_counterfeit": {
        "type": "noul",
        "noul": 0.05
      },
      "appears_recalled": {
        "type": "noul",
        "noul": 0.8
      }
    },
    "action": "hold",
    "error": null
  }
]
```
