# marketplace-ops-sellers_onboarding-z-ai_glm-5.3-flash-r2

Site: `src/sellers/onboarding.ts`

Brief given to both authors:

> Change screenApplication() so verified applications outside restricted categories are approved or rejected from the description (a real business selling permitted goods is approved; a restricted or misrepresented business is rejected), with review only for unclear cases.

## Candidate A

### Design

```json
{
  "questions": {
    "business_assessment": {
      "type": "choice",
      "instructions": "Decide what the seller application in `business` is. Judge the business itself, not the writing quality. Approve when a real, operating business selling goods or services outside `policy.restricted_categories` is described, consistently with the declared categories. Reject when the business sells restricted goods or services, or when the application misrepresents the business: restricted products relabelled under a permitted category, ticket reselling, or boilerplate with no actual business behind it. Do not credit the description's own assurances of legitimacy; a concrete business with real products, operations, or customers must be evident. If the application does not clearly establish either, the outcome is review.",
      "criteria": {
        "approve": "A real, operating business whose goods or services fall outside `policy.restricted_categories` and whose description is consistent with the declared categories.",
        "reject": "A business that sells goods or services in a restricted category, or a misrepresentation: restricted products relabelled under a permitted category, ticket reselling, or boilerplate with no actual business behind it.",
        "review": "An application too vague, incomplete, or contradictory to tell whether a real permitted business or a restricted or misrepresented one stands behind it."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const RESTRICTED = ['tobacco', 'alcohol', 'pharmacy', 'weapons', 'gambling'];\n// Hard policy rules settle these in code; skip the model entirely.\nif (!input.identityVerified || !input.bankVerified) return null;\nif (Array.isArray(input.categories) && input.categories.some((c) => RESTRICTED.includes(c))) return null;\nconst description = typeof input.description === 'string' ? input.description.trim() : '';\n// Blank description: nothing establishes a real business and nothing exists for the model to read.\nif (!description) return null;\nreturn {\n  business: {\n    name: typeof input.businessName === 'string' ? input.businessName : '',\n    description: description,\n    declared_categories: Array.isArray(input.categories) ? input.categories : []\n  },\n  policy: { restricted_categories: RESTRICTED }\n};",
  "decide_js": "const RESTRICTED = ['tobacco', 'alcohol', 'pharmacy', 'weapons', 'gambling'];\n// Code-side hard rules, re-applied here so model-skipped inputs still get an action.\nif (!input.identityVerified || !input.bankVerified) return 'reject';\nif (Array.isArray(input.categories) && input.categories.some((c) => RESTRICTED.includes(c))) return 'reject';\nconst description = typeof input.description === 'string' ? input.description.trim() : '';\nif (!description) return 'reject';\n// Model judgment: which outcome did the description earn?\nconst answer = answers.business_assessment;\nif (!answer || answer.type !== 'choice') return 'review'; // unexpected answer shape -> human queue\nconst probabilities = (answer.probabilities && typeof answer.probabilities === 'object') ? answer.probabilities : null;\nconst p = (probabilities && typeof probabilities[answer.choice] === 'number') ? probabilities[answer.choice] : null;\n// Gates, provisional until probed on real inputs; rerun the probe on any model change.\nconst APPROVE_MIN = 0.7; // false approve puts a restricted or fake business live: strictest gate\nconst REJECT_MIN = 0.6;  // false reject costs a real seller a reapplication: looser gate\nif (answer.choice === 'approve') return (p !== null && p >= APPROVE_MIN) ? 'approve' : 'review';\nif (answer.choice === 'reject') return (p !== null && p >= REJECT_MIN) ? 'reject' : 'review';\nreturn 'review';",
  "notes": "The model makes the single judgment the human reviewers were making: one choice over approve / reject / review, read from the business name, description, and declared categories in `business` plus the restricted-category policy in `policy.restricted_categories`, with criteria that name the reject patterns from the reviewer notes (restricted goods under a permitted category, ticket reselling, boilerplate with no real business) and instruct the model not to credit the description's own legitimacy assurances. Code computes everything deterministic: unverified identity or bank, a declared restricted category, or a blank description returns 'reject' with no model call (blank is treated as no actual business behind the application, not as unclear), and decide_js re-applies those rules so skipped inputs still return an action. The choice is gated in code at named constants — approve needs its probability >= 0.7, reject >= 0.6, asymmetric because a false approval puts a restricted or fake business live while a false rejection only costs a real seller a reapplication — and anything contested (a `review` choice, a top probability under the gate, a missing key, wrong type, or missing probabilities) falls back to the human queue, which is the existing cheap fallback. These thresholds are provisional until the step-8 probe (the ceramics-style real seller, restricted goods described under a permitted category, dropshipper boilerplate, ticket reseller, a vague one-liner, negated restricted mentions such as 'we do not sell alcohol', and adversarial text asserting its own legitimacy) runs against the pinned build; pin the canonical_slug in config, log the response `model` with every stored answer, and recalibrate on any model change."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "business": {
        "name": "Marta's Ceramics",
        "description": "I make hand-thrown stoneware mugs and bowls in my studio in Leeds and sell them at markets. Looking to reach more customers online.",
        "declared_categories": [
          "home"
        ]
      },
      "policy": {
        "restricted_categories": [
          "tobacco",
          "alcohol",
          "pharmacy",
          "weapons",
          "gambling"
        ]
      }
    },
    "answers": {
      "business_assessment": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "reject": 0,
          "review": 0.01,
          "approve": 0.99
        },
        "confidence": 0.99
      }
    },
    "action": "approve",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "business": {
        "name": "BestDeals Ltd",
        "description": "We offer premium quality products at competitive prices with excellent customer service and fast delivery to satisfy all customer needs.",
        "declared_categories": [
          "electronics",
          "home"
        ]
      },
      "policy": {
        "restricted_categories": [
          "tobacco",
          "alcohol",
          "pharmacy",
          "weapons",
          "gambling"
        ]
      }
    },
    "answers": {
      "business_assessment": {
        "type": "choice",
        "choice": "review",
        "probabilities": {
          "reject": 0.07,
          "review": 0.82,
          "approve": 0.11
        },
        "confidence": 0.73
      }
    },
    "action": "review",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "business": {
        "name": "Vape Corner",
        "description": "Disposable vapes and e-liquids, all the popular flavours, listed under accessories so they show up in search.",
        "declared_categories": [
          "accessories"
        ]
      },
      "policy": {
        "restricted_categories": [
          "tobacco",
          "alcohol",
          "pharmacy",
          "weapons",
          "gambling"
        ]
      }
    },
    "answers": {
      "business_assessment": {
        "type": "choice",
        "choice": "reject",
        "probabilities": {
          "reject": 0.9299999999999999,
          "review": 0.03,
          "approve": 0.04
        },
        "confidence": 0.91
      }
    },
    "action": "reject",
    "error": null
  }
]
```
