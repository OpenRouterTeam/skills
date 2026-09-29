# marketplace-ops-listings_prohibited-z-ai_glm-5.3-flash-r2

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
      "instructions": "Is this listing offering a weapon for sale?",
      "criteria": {
        "true": "The item offered is designed or marketed as a weapon, such as a firearm, ammunition, a taser or stun device, pepper spray, a dagger, or a knife made as a fighting weapon.",
        "false": "The item offered is an ordinary household or workplace tool that happens to have a blade or edge, such as kitchen knives, a butter knife, scissors, or a utility knife, or the listing offers no weapon-like item."
      }
    },
    "offers_counterfeit": {
      "type": "noul",
      "instructions": "Is this listing offering a counterfeit or inauthentic product?",
      "criteria": {
        "true": "The listing offers a replica, knockoff, or imitation of a branded product, or a brand-name product whose offer signals it is not genuine, such as 'AAA quality' or 'mirror quality' wording, an 'unbranded version' of a branded good, or a brand-name item whose price or condition indicates it is not authentic, for example suspiciously cheap with no original packaging.",
        "false": "The listing offers a genuine product, including a legitimate used, discounted, or unbranded product that does not imitate a brand."
      }
    },
    "is_recalled": {
      "type": "noul",
      "instructions": "Does this listing appear to offer a recalled product or an item subject to a safety notice?",
      "criteria": {
        "true": "The listing indicates the product was recalled or withdrawn for safety reasons, is subject to a safety notice, or is offered as a pre-ban item made before a ban on its sale took effect.",
        "false": "There is no indication that the product was recalled, withdrawn for safety reasons, or banned."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "// Strike rule stays in code: three or more seller strikes holds the listing and skips the model entirely.\nif (input.sellerStrikes >= 3) return null;\nreturn {\n  title: input.title,\n  description: input.description,\n  category: input.category\n};",
  "decide_js": "// Named gates; starting values chosen for the cost asymmetry, calibrate on the probe set before trusting (see notes).\nconst BLOCK_T = 0.8;   // weapon or counterfeit at least this likely -> block (high because wrongful blocks drive appeals)\nconst HOLD_T = 0.7;    // recalled at least this likely -> hold\nconst SURE_CLEAN = 0.35; // below this on every question the listing is confidently clean; at or above, up to the gate, the screen is unsure\n// Strike rule: build_state_js returned null and skipped the model.\nif (!state) return \"hold\";\nconst w = answers.offers_weapon;\nconst c = answers.offers_counterfeit;\nconst r = answers.is_recalled;\n// Missing or malformed answers: fail closed to human review rather than guess.\nif (!w || !c || !r || w.type !== \"noul\" || c.type !== \"noul\" || r.type !== \"noul\") return \"hold\";\nconst pW = w.noul;\nconst pC = c.noul;\nconst pR = r.noul;\nif (pW >= BLOCK_T || pC >= BLOCK_T) return \"block\";\nif (pR >= HOLD_T) return \"hold\";\n// Unsure band: any probability between SURE_CLEAN and its action gate means the screen is unsure -> hold for review.\nif (pW >= SURE_CLEAN || pC >= SURE_CLEAN || pR >= SURE_CLEAN) return \"hold\";\nreturn \"publish\";",
  "notes": "The model replaces the three term lists with three independent noul judgments made in one Decisions request over a state of {title, description, category}: does the listing offer a weapon (criteria exclude ordinary bladed tools like kitchen knives and butter knives, fixing the false blocks), does it offer a counterfeit or inauthentic product (criteria include authenticity signals like 'AAA quality' wording or a brand-name item suspiciously cheap with no box, catching what the keyword list missed), and does it appear to be a recalled or safety-noticed product. Code owns everything deterministic: the strike rule (sellerStrikes >= 3) returns hold and skips the model via a null state; the gates are named constants — block when weapon or counterfeit P(yes) >= 0.8, chosen high because wrongful blocks drive the appeal volume; hold when recalled P(yes) >= 0.7; and the unsure band holds the listing whenever any probability lands in [0.35, its gate), so the screen defers to review instead of guessing. Block precedes hold, matching the old check order, and missing or malformed answers fail closed to hold. These thresholds are reasoned starting values, not measured ones: run a probe set (clear blocks, clear publishes, negations like 'no weapons' or 'not a replica', and adversarial listings that argue for their own innocence) through decide.ts --compare and reset each constant from the observed probabilities, then re-probe whenever the pinned model slug changes."
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
        "noul": 0.06
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
      "offers_weapon": {
        "type": "noul",
        "noul": 0.01
      },
      "offers_counterfeit": {
        "type": "noul",
        "noul": 0.98
      },
      "is_recalled": {
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
        "noul": 0.01
      },
      "offers_counterfeit": {
        "type": "noul",
        "noul": 0.04
      },
      "is_recalled": {
        "type": "noul",
        "noul": 0.72
      }
    },
    "action": "hold",
    "error": null
  }
]
```
