# marketplace-ops-catalog_condition-z-ai_glm-5.3-flash-r2

Site: `src/catalog/condition.ts`

Brief given to both authors:

> Replace describedCondition() in checkCondition() with a decision model that reads the condition the description implies, and keep the comparison with the declared condition in code.

## Candidate A

### Design

```json
{
  "questions": {
    "implied_condition": {
      "type": "choice",
      "instructions": "Read the seller's description and determine what physical condition the LISTED ITEM ITSELF actually appears to be in. Judge the item, not its packaging, box, or accessories, unless the problem directly affects the item. Do not anchor on optimistic marketing words alone; weigh concrete evidence of wear, damage, or malfunction stated anywhere in the description, including things admitted incidentally ('but', 'except', 'only issue'). Pick the single best-matching grade.",
      "criteria": {
        "new": "Unused and factory-fresh: sealed, unopened, tags attached, brand new, or explicitly never powered on / never used.",
        "like_new": "Essentially no signs of use: barely used, mint, opened once, or imperfections too trivial to distinguish from new.",
        "good": "Fully functional with light wear: light scuffs, small marks, minor blemishes, ordinary signs of careful previous use.",
        "fair": "Usable but visibly compromised cosmetically: heavy scratches, dents, stains, worn surfaces, noticeable cosmetic damage.",
        "for_parts": "Not fully functional or damaged beyond cosmetic issues: won't power on, cracked screens or casings, mechanical faults, sold for spares or repair."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "// Send only the description; withholding the declared grade prevents the model\n// from anchoring on the seller's claim.\nif (!input || typeof input.description !== 'string' || !input.description.trim()) {\n  return null;\n}\nreturn { description: input.description };",
  "decide_js": "var ORDER = ['for_parts', 'fair', 'good', 'like_new', 'new'];\n\nvar ans = answers && answers.implied_condition;\n// Treat a missing answer or wrong type as unusable rather than guessing.\nif (!ans || typeof ans !== 'object' || ans.type !== 'choice') return 'accept';\n\nvar opt = ans.choice;\nif (typeof opt !== 'string' || ORDER.indexOf(opt) === -1) return 'accept';\n\n// Prefer the highest-probability known option when probabilities came back,\n// and refuse to override the declared grade on weak inference.\nif (ans.probabilities && typeof ans.probabilities === 'object') {\n  var best = null, bestP = -1;\n  for (var k in ans.probabilities) {\n    if (Object.prototype.hasOwnProperty.call(ans.probabilities, k)\n        && ORDER.indexOf(k) !== -1\n        && ans.probabilities[k] > bestP) {\n      best = k;\n      bestP = ans.probabilities[k];\n    }\n  }\n  if (best !== null) {\n    if (bestP < 0.34) return 'accept';\n    opt = best;\n  }\n}\n\n// Comparison stays in code: flag only when the described condition ranks\n// strictly worse than the declared one.\nreturn ORDER.indexOf(opt) < ORDER.indexOf(input.declared) ? 'flag' : 'accept';",
  "notes": "A single choice question asks the model to infer the real condition of the item itself from the free-text description, judging the item rather than its packaging and weighing incidental admissions ('box dented but item sealed' -> new; 'screen cracked but rest pristine' -> for_parts/fair), replacing the brittle keyword hints. Code keeps full control of the policy: it validates the answer type, takes the highest-probability known option, refuses to flag when the top probability is under 0.34 (mirroring the old behaviour of accepting unverifiable descriptions), and finally flags only when the inferred condition ranks strictly lower than the declared one on the for_parts<fair<good<like_new<new scale. Missing/malformed answers degrade to accept rather than inventing a default condition."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "description": "The box has a small dent from shipping but the item itself is sealed and unopened."
    },
    "answers": {
      "implied_condition": {
        "type": "choice",
        "choice": "new",
        "probabilities": {
          "for_parts": 0,
          "good": 0,
          "like_new": 0,
          "new": 1,
          "fair": 0
        },
        "confidence": 1
      }
    },
    "action": "accept",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "description": "Screen cracked in one corner but everything else works and looks pristine."
    },
    "answers": {
      "implied_condition": {
        "type": "choice",
        "choice": "for_parts",
        "probabilities": {
          "like_new": 0,
          "fair": 0.14,
          "good": 0.01,
          "for_parts": 0.85,
          "new": 0
        },
        "confidence": 0.81
      }
    },
    "action": "flag",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "description": "A few scratches on the back, works fine, comes with the charger."
    },
    "answers": {
      "implied_condition": {
        "type": "choice",
        "choice": "good",
        "probabilities": {
          "good": 0.98,
          "new": 0,
          "for_parts": 0,
          "fair": 0.02,
          "like_new": 0
        },
        "confidence": 0.98
      }
    },
    "action": "flag",
    "error": null
  }
]
```
