# marketplace-ops-listings_prohibited-openai_gpt-5.6-luna-r1

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
      "instructions": "Does this listing offer a weapon or weapon-like self-defense device? Judge the item being offered from the listing as a whole, rather than matching isolated words. Ordinary kitchen knives, cooking tools, craft tools, and sporting goods are not weapons unless the listing presents them as weapons.",
      "criteria": {
        "true": "The listing offers a firearm, ammunition, weapon, or weapon-like self-defense device.",
        "false": "The listing does not offer a weapon; any blade or similar item is an ordinary household, craft, sporting, or other non-weapon product."
      }
    },
    "appears_counterfeit": {
      "type": "noul",
      "instructions": "Does this listing appear to offer a counterfeit, unauthorized imitation, or fake branded product? Judge the product and evidence in the listing, not merely whether it is inexpensive, lacks packaging, or uses promotional wording.",
      "criteria": {
        "true": "The listing appears to offer a fake, unauthorized copy, replica, or counterfeit branded product.",
        "false": "The listing does not appear counterfeit, or the available information is consistent with a genuine or unbranded product."
      }
    },
    "appears_recalled": {
      "type": "noul",
      "instructions": "Does this listing appear to offer a product that has been recalled or is subject to a product safety notice? Infer this from the product and listing details, including explicit recall or safety information, while treating an explicit statement that there is no recall as evidence against this condition.",
      "criteria": {
        "true": "The product appears to be recalled or subject to a product safety notice.",
        "false": "The product does not appear to be recalled or subject to a product safety notice."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (!input || Number(input.sellerStrikes) >= 3) return null;\\nconst title = typeof input.title === 'string' ? input.title : '';\\nconst description = typeof input.description === 'string' ? input.description : '';\\nif (!title.trim() && !description.trim()) return null;\\nreturn { title, description, category: typeof input.category === 'string' ? input.category : '' };",
  "decide_js": "if (!input || Number(input.sellerStrikes) >= 3 || !state) return 'hold';\\nconst WEAPON_BLOCK_THRESHOLD = 0.75;\\nconst COUNTERFEIT_BLOCK_THRESHOLD = 0.75;\\nconst RECALL_HOLD_THRESHOLD = 0.75;\\nconst UNCERTAINTY_LOW = 0.25;\\nconst UNCERTAINTY_HIGH = 0.75;\\nfunction probability(key) {\\n  const answer = answers && answers[key];\\n  if (!answer || answer.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)) return null;\\n  return answer.noul;\\n}\\nconst weapon = probability('offers_weapon');\\nconst counterfeit = probability('appears_counterfeit');\\nconst recalled = probability('appears_recalled');\\nif (weapon === null || counterfeit === null || recalled === null) return 'hold';\\nif ([weapon, counterfeit, recalled].some((p) => p > UNCERTAINTY_LOW && p < UNCERTAINTY_HIGH)) return 'hold';\\nif (recalled >= RECALL_HOLD_THRESHOLD) return 'hold';\\nif (weapon >= WEAPON_BLOCK_THRESHOLD || counterfeit >= COUNTERFEIT_BLOCK_THRESHOLD) return 'block';\\nreturn 'publish';",
  "notes": "The model independently judges whether the listing offers a weapon, appears counterfeit, or appears to involve a recalled product; it is instructed to judge the product rather than match terms, so ordinary kitchen knives can publish while weapon offerings can block. Code keeps the seller-strike rule, skips the model and holds listings with three or more strikes, treats missing or empty listing content as unsure, and applies the returned noul probabilities. A probability of at least 0.75 blocks a weapon or counterfeit, at least 0.75 holds a recalled product, and any probability strictly between 0.25 and 0.75 is treated as uncertainty and held."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": null,
    "answers": {},
    "action": null,
    "error": "Invalid or unexpected token"
  },
  {
    "skipped_model": false,
    "state": null,
    "answers": {},
    "action": null,
    "error": "Invalid or unexpected token"
  },
  {
    "skipped_model": false,
    "state": null,
    "answers": {},
    "action": null,
    "error": "Invalid or unexpected token"
  }
]
```
