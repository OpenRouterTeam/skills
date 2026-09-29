# marketplace-ops-sellers_onboarding-openai_gpt-5.6-luna-r2

Site: `src/sellers/onboarding.ts`

Brief given to both authors:

> Change screenApplication() so verified applications outside restricted categories are approved or rejected from the description (a real business selling permitted goods is approved; a restricted or misrepresented business is rejected), with review only for unclear cases.

## Candidate B

### Design

```json
{
  "questions": {
    "eligibility": {
      "type": "choice",
      "instructions": "Assess whether this verified seller is a genuine business selling permitted goods based on its business name, description, and declared categories. Choose approve only when the description clearly supports a real business selling permitted goods. Choose reject when it indicates restricted goods, a dropshipper or reseller disguising restricted goods, a ticket reseller, a materially misleading description, or boilerplate with no identifiable business activity. Choose review only when the available information is genuinely unclear or contradictory.",
      "criteria": {
        "approve": "The description clearly and credibly describes a real business selling permitted goods or services, consistent with the declared categories.",
        "reject": "The description indicates restricted goods or activity, a misrepresented or disguised business, ticket reselling, or boilerplate with no actual business behind it.",
        "review": "The description is too vague, contradictory, or ambiguous to determine whether the business is genuine and permitted."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const restricted = [\"tobacco\", \"alcohol\", \"pharmacy\", \"weapons\", \"gambling\"]; const categories = Array.isArray(input.categories) ? input.categories : []; const normalizedCategories = categories.map((c) => String(c).trim().toLowerCase()); const ineligible = input.identityVerified !== true || input.bankVerified !== true || normalizedCategories.some((c) => restricted.includes(c)); if (ineligible) return null; return { businessName: String(input.businessName || \"\"), description: String(input.description || \"\"), categories: categories.map((c) => String(c)), country: String(input.country || \"\"), eligible: true };",
  "decide_js": "if (state === null || !state || state.eligible !== true) return \"reject\"; const answer = answers && answers.eligibility; if (!answer || answer.type !== \"choice\") return \"review\"; const choice = answer.choice; if (choice !== \"approve\" && choice !== \"reject\" && choice !== \"review\") return \"review\"; if (choice === \"review\") return \"review\"; if (typeof answer.confidence === \"number\" && answer.confidence < 0.7) return \"review\"; if (answer.probabilities && typeof answer.probabilities[choice] === \"number\" && answer.probabilities[choice] < 0.6) return \"review\"; return choice;",
  "notes": "Applications that fail identity or bank verification, or declare a restricted category, are rejected in JavaScript without using the model. For otherwise eligible applications, the model judges whether the business description credibly represents a real seller of permitted goods and identifies restricted, disguised, ticket-resale, misleading, or boilerplate businesses. A model response of review, an invalid or missing answer, confidence below 0.7, or a selected probability below 0.6 produces review; otherwise the selected approve or reject outcome is returned."
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
      "country": "GB",
      "eligible": true
    },
    "answers": {
      "eligibility": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "review": 0,
          "reject": 0,
          "approve": 1
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
      "country": "GB",
      "eligible": true
    },
    "answers": {
      "eligibility": {
        "type": "choice",
        "choice": "approve",
        "probabilities": {
          "review": 0.25,
          "approve": 0.53,
          "reject": 0.22
        },
        "confidence": 0.29
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
      "country": "GB",
      "eligible": true
    },
    "answers": {
      "eligibility": {
        "type": "choice",
        "choice": "reject",
        "probabilities": {
          "reject": 0.89,
          "review": 0.02,
          "approve": 0.09
        },
        "confidence": 0.84
      }
    },
    "action": "reject",
    "error": null
  }
]
```
