# marketplace-ops-sellers_onboarding-openai_gpt-5.6-luna-r1

Site: `src/sellers/onboarding.ts`

Brief given to both authors:

> Change screenApplication() so verified applications outside restricted categories are approved or rejected from the description (a real business selling permitted goods is approved; a restricted or misrepresented business is rejected), with review only for unclear cases.

## Candidate B

### Design

```json
{
  "questions": {
    "business_screening": {
      "type": "choice",
      "instructions": "Classify the seller using the business name, description, and categories in state. Decide whether this is a genuine business selling permitted goods or services, a business that is restricted or misrepresented, or an unclear case.",
      "criteria": {
        "approve": "The description gives credible, specific evidence of a real operating business selling goods or services permitted by the stated categories. It is consistent with the business name and does not indicate prohibited products, ticket resale, relabelling, or deceptive activity.",
        "reject": "The description indicates restricted goods or services, a dropshipper or seller relabelling restricted products, ticket resale, a materially misrepresented business, or clearly no genuine business behind the application.",
        "review": "The description is too vague, boilerplate, contradictory, or otherwise insufficient to determine whether the business is genuine and permitted."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const restricted = new Set([\"tobacco\", \"alcohol\", \"pharmacy\", \"weapons\", \"gambling\"]); const categories = Array.isArray(input.categories) ? input.categories : []; if (!input.identityVerified || !input.bankVerified || categories.some((category) => restricted.has(String(category).trim().toLowerCase()))) return null; return { businessName: input.businessName, description: input.description, categories: categories, country: input.country };",
  "decide_js": "const restricted = new Set([\"tobacco\", \"alcohol\", \"pharmacy\", \"weapons\", \"gambling\"]); const categories = Array.isArray(input.categories) ? input.categories : []; if (!input.identityVerified || !input.bankVerified || categories.some((category) => restricted.has(String(category).trim().toLowerCase()))) return \"reject\"; if (state === null) return \"reject\"; const answer = answers && answers.business_screening; if (!answer || answer.type !== \"choice\") return \"review\"; if (answer.choice !== \"approve\" && answer.choice !== \"reject\" && answer.choice !== \"review\") return \"review\"; if (answer.choice === \"review\") return \"review\"; if (Object.prototype.hasOwnProperty.call(answer, \"confidence\") && (typeof answer.confidence !== \"number\" || answer.confidence < 0.75)) return \"review\"; if (Object.prototype.hasOwnProperty.call(answer, \"probabilities\")) { const probabilities = answer.probabilities; const probability = probabilities && probabilities[answer.choice]; if (typeof probability !== \"number\" || probability < 0.75) return \"review\"; } return answer.choice;",
  "notes": "The model evaluates whether the description supports a genuine permitted business and detects restricted products, relabelling, ticket resale, misrepresentation, or insufficient detail. Code deterministically rejects failed identity or bank verification and any category matching the restricted-category list; otherwise it accepts a model approve or reject only when the choice is valid and any supplied confidence and probability are at least 0.75, sending low-confidence or unclear cases to review."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "businessName": "Marta's Ceramics",
      "description": "I make hand-thrown stoneware mugs and bowls in my studio in Leeds and sell them at markets. Looking to reach more customers online.",
      "categories": [
        "home"
      ],
      "country": "GB"
    },
    "answers": {
      "business_screening": {
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
      "businessName": "BestDeals Ltd",
      "description": "We offer premium quality products at competitive prices with excellent customer service and fast delivery to satisfy all customer needs.",
      "categories": [
        "electronics",
        "home"
      ],
      "country": "GB"
    },
    "answers": {
      "business_screening": {
        "type": "choice",
        "choice": "review",
        "probabilities": {
          "reject": 0,
          "review": 0.81,
          "approve": 0.19
        },
        "confidence": 0.72
      }
    },
    "action": "review",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "businessName": "Vape Corner",
      "description": "Disposable vapes and e-liquids, all the popular flavours, listed under accessories so they show up in search.",
      "categories": [
        "accessories"
      ],
      "country": "GB"
    },
    "answers": {
      "business_screening": {
        "type": "choice",
        "choice": "reject",
        "probabilities": {
          "approve": 0.12,
          "review": 0.09,
          "reject": 0.79
        },
        "confidence": 0.68
      }
    },
    "action": "review",
    "error": null
  }
]
```
