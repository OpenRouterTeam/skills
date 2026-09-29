# marketplace-ops-listings_prohibited-z-ai_glm-5.3-flash-r1

Site: `src/listings/prohibited.ts`

Brief given to both authors:

> Replace the term lists in screenListing() so a listing is published, blocked when it offers a weapon or a counterfeit, or held when it appears to be a recalled product or the screen is unsure. Keep the strike rule.

## Candidate A

### Design

```json
{
  "questions": {
    "classification": {
      "type": "choice",
      "instructions": "Read the listing title and description together and classify what is actually being offered. Judge overall intent and context, not isolated keywords. Choose exactly one option.",
      "criteria": {
        "clean": "An ordinary item permitted for sale, including everyday tools and household goods such as kitchen knife sets, cutlery, pocket multi-tools, or craft blades used for cooking or utility purposes.",
        "weapon": "Something intended as a weapon: firearms, pistols, rifles, ammunition, tasers/stun devices, pepper spray, daggers, switchblades, combat or fighting knives, or any blade marketed primarily for harming people.",
        "counterfeit": "A fake or unauthorized copy of a branded product: explicit imitation language (replica, knockoff, inspired-by, AAA/mirror quality, unbranded version of a known brand), or a claim of authenticity that is contradicted by obvious red flags such as prices far below retail paired with missing packaging or papers.",
        "recalled": "A product that appears to be recalled, subject to a safety notice, banned, or restricted (including pre-ban items), based on wording in the listing itself.",
        "unsure": "There is not enough reliable information in the listing to place it confidently in any other category."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return {\n  title: String(input.title || ''),\n  description: String(input.description || ''),\n  category: String(input.category || '')\n};",
  "decide_js": "// Strike rule stays deterministic.\nvar strikes = Number(input.sellerStrikes);\nif (Number.isFinite(strikes) && strikes >= 3) return \"hold\";\n\nvar a = answers.classification;\nif (!a || a.type !== \"choice\") return \"hold\"; // fail closed on malformed answers\n\nvar probs = a.probabilities || {};\nfunction num(x) { return typeof x === \"number\" && isFinite(x) ? x : 0; }\nvar raw = {\n  clean: num(probs[\"clean\"]),\n  weapon: num(probs[\"weapon\"]),\n  counterfeit: num(probs[\"counterfeit\"]),\n  recalled: num(probs[\"recalled\"]),\n  unsure: num(probs[\"unsure\"])\n};\nvar total = raw.clean + raw.weapon + raw.counterfeit + raw.recalled + raw.unsure;\nif (!(total > 0)) return \"hold\";\nvar p = {};\nfor (var k in raw) p[k] = raw[k] / total;\n\nvar blockRisk = p.weapon + p.counterfeit;\nvar holdRisk = p.recalled + p.unsure;\n\n// Block only on confident weapon/counterfeit judgments.\nif (raw.weapon >= 0.6 && raw.weapon >= raw.counterfeit) return \"block\";\nif (raw.counterfeit >= 0.6 && raw.counterfeit > raw.weapon) return \"block\";\n\n// Publish only when the listing looks confidently clean:\n// little residual weapon/counterfeit mass and little recall/uncertainty mass.\nif (p.clean >= 0.75 && blockRisk <= 0.15 && holdRisk <= 0.25) return \"publish\";\n\n// Recalled-looking listings, mixed signals, or genuine uncertainty go to manual review.\nreturn \"hold\";",
  "notes": "One choice-type question classifies each listing into clean / weapon / counterfeit / recalled / unsure, letting the model weigh context (so kitchen knife sets and butter knives stay clean while combat-style offerings count as weapons, and plausible-authenticity red flags like deep discounts without packaging feed the counterfeit judgment). Code keeps the existing strike rule deterministically (sellerStrikes >= 3 holds), then reads the normalized probability distribution: it blocks only when weapon or counterfeit probability reaches 0.6 and dominates the other, publishes only when clean probability is at least 0.75 with at most 0.15 combined weapon/counterfeit mass and 0.25 combined recalled/unsure mass, and holds everything else — covering recalled-looking listings, borderline cases, and any missing or non-choice answer (fail-closed). Given that successful appeals were already common, erring toward hold over wrongful public posting preserves trust-and-safety posture while eliminating hand-maintained term lists."
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
      "classification": {
        "type": "choice",
        "choice": "clean",
        "probabilities": {
          "counterfeit": 0,
          "clean": 1,
          "recalled": 0,
          "weapon": 0,
          "unsure": 0
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
      "classification": {
        "type": "choice",
        "choice": "counterfeit",
        "probabilities": {
          "unsure": 0,
          "counterfeit": 1,
          "clean": 0,
          "recalled": 0,
          "weapon": 0
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
      "classification": {
        "type": "choice",
        "choice": "recalled",
        "probabilities": {
          "recalled": 0.92,
          "unsure": 0.02,
          "counterfeit": 0,
          "weapon": 0,
          "clean": 0.06
        },
        "confidence": 0.9
      }
    },
    "action": "hold",
    "error": null
  }
]
```
