# marketplace-ops-sellers_onboarding-z-ai_glm-5.3-flash-r2

Site: `src/sellers/onboarding.ts`

Brief given to both authors:

> Change screenApplication() so verified applications outside restricted categories are approved or rejected from the description (a real business selling permitted goods is approved; a restricted or misrepresented business is rejected), with review only for unclear cases.

## Candidate B

### Design

```json
{
  "questions": {
    "outcome": {
      "type": "choice",
      "instructions": "Read the seller's self-description together with the listed categories and decide whether this marketplace application should be approved outright, rejected outright, or escalated to a human reviewer. Judge whether the description identifies a real, operating business selling lawful, unrestricted goods or services, and whether anything suggests restricted trade or misrepresentation.",
      "criteria": {
        "approve": "The description clearly identifies a genuine, specific business (concrete products, materials, location, or service offered) whose trade falls within the stated categories and involves nothing restricted, regulated, or resale-of-tickets-like. Examples: handmade ceramics sold at local markets, a tutoring agency, a bakery.",
        "reject": "There is evidence of restricted or problematic activity: dropshipped or relabelled tobacco, alcohol, pharmacy, weapons, or gambling products; unauthorized event-ticket reselling; or a generic, template-like, or content-free description ('online store selling various products', marketing copy with no identifiable business) suggesting no real operator stands behind the application, or claims that contradict the stated categories.",
        "review": "The description sounds plausible but is genuinely ambiguous: you cannot confidently determine either that a real permitted business exists or that something prohibited is going on. Reserve this for borderline cases where neither approval nor rejection is clearly justified."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "// Only verified, non-restricted applications reach the model.\nvar RESTRICTED = ['tobacco', 'alcohol', 'pharmacy', 'weapons', 'gambling'];\nif (!input.identityVerified || !input.bankVerified) return null;\nvar cats = Array.isArray(input.categories) ? input.categories.map(function (c) { return String(c).toLowerCase(); }) : [];\nif (cats.some(function (c) { return RESTRICTED.indexOf(c) !== -1; })) return null;\nreturn {\n  business_name: input.businessName,\n  description: input.description,\n  categories: input.categories,\n  country: input.country\n};",
  "decide_js": "var RESTRICTED = ['tobacco', 'alcohol', 'pharmacy', 'weapons', 'gambling'];\nfunction ineligible(i) {\n  if (!i || typeof i !== 'object') return true;\n  if (!i.identityVerified || !i.bankVerified) return true;\n  var cats = Array.isArray(i.categories) ? i.categories.map(function (c) { return String(c).toLowerCase(); }) : [];\n  return cats.some(function (c) { return RESTRICTED.indexOf(c) !== -1; });\n}\n// Skipped-model path: hard policy failures reject; anything else fails safe to review.\nif (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {\n  return ineligible(input) ? 'reject' : 'review';\n}\nvar a = answers.outcome;\nif (!a || typeof a !== 'object' || a.type !== 'choice') return 'review'; // missing/unexpected answer -> fail safe\nvar probs = (a.probabilities && typeof a.probabilities === 'object') ? a.probabilities : {};\nvar ranked = Object.keys(probs)\n  .map(function (k) { return [String(k).toLowerCase(), Number(probs[k]) || 0]; })\n  .filter(function (p) { return p[0] === 'approve' || p[0] === 'reject' || p[0] == 'review'; })\n  .sort(function (x, y) { return y[1] - x[1]; });\nvar conf = typeof a.confidence === 'number' ? a.confidence : 0;\nvar top = ranked.length ? ranked[0] : null;\nvar runnerUp = ranked.length > 1 ? ranked[1][1] : 0;\nvar decisive = !!top && top[1] >= 0.75 && conf >= 0.6 && (top[1] - runnerUp) >= 0.25;\nif (decisive && (top[0] === 'approve' || top[0] === 'reject')) return top[0];\nreturn 'review';",
  "notes": "Code handles the mechanical gates deterministically: build_state_js skips the model entirely (returns null) for unverified identities/banks or applications touching a restricted category, and decide_js rejects those directly, preserving existing policy with zero API spend. Everything else sends the business name, description, categories, and country to the model under a single three-way choice question (approve / reject / review) whose criteria mirror the reviewers' job: approve genuine businesses selling permitted goods, reject restricted trades, ticket resellers, relabelled dropshippers, and boilerplate descriptions with no real business, and reserve review for ambiguity. decide_js requires a well-formed choice answer and acts on approve/reject only when the model is confident: top probability >= 0.75, confidence >= 0.6, and a lead over the runner-up of >= 0.25; otherwise (low confidence, near ties, malformed or unexpectedly typed answers, or a decisive 'review' verdict) it fails safe to human review. At most one Decisions request runs per input."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "business_name": "Marta's Ceramics",
      "description": "I make hand-thrown stoneware mugs and bowls in my studio in Leeds and sell them at markets. Looking to reach more customers online.",
      "categories": [
        "home"
      ],
      "country": "GB"
    },
    "answers": {
      "outcome": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "approve": 1,
          "reject": 0,
          "review": 0
        },
        "confidence": 1
      }
    },
    "action": "approve",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "business_name": "BestDeals Ltd",
      "description": "We offer premium quality products at competitive prices with excellent customer service and fast delivery to satisfy all customer needs.",
      "categories": [
        "electronics",
        "home"
      ],
      "country": "GB"
    },
    "answers": {
      "outcome": {
        "type": "choice",
        "choice": "reject",
        "probabilities": {
          "reject": 0.81,
          "approve": 0.04,
          "review": 0.15
        },
        "confidence": 0.71
      }
    },
    "action": "reject",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "business_name": "Vape Corner",
      "description": "Disposable vapes and e-liquids, all the popular flavours, listed under accessories so they show up in search.",
      "categories": [
        "accessories"
      ],
      "country": "GB"
    },
    "answers": {
      "outcome": {
        "type": "choice",
        "choice": "reject",
        "probabilities": {
          "reject": 0.83,
          "approve": 0.02,
          "review": 0.15
        },
        "confidence": 0.75
      }
    },
    "action": "reject",
    "error": null
  }
]
```
