# marketplace-ops-sellers_onboarding-openai_gpt-5.6-luna-r3

Site: `src/sellers/onboarding.ts`

Brief given to both authors:

> Change screenApplication() so verified applications outside restricted categories are approved or rejected from the description (a real business selling permitted goods is approved; a restricted or misrepresented business is rejected), with review only for unclear cases.

## Candidate B

### Design

```json
{
  "questions": {
    "is_eligible_business": {
      "type": "noul",
      "instructions": "Is this a genuine business that sells permitted goods or services and is accurately represented by the application, based on the business name, description, and categories?",
      "criteria": {
        "true": "The application describes a real, specific business selling permitted goods or services. The description is consistent with the categories and does not indicate restricted products, ticket resale, relabelled restricted goods, or generic boilerplate with no identifiable business activity.",
        "false": "The business is restricted, misrepresented, inconsistent with its categories, appears to relabel or dropship restricted products, is a ticket reseller, or the description indicates there is no actual business behind the application."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (!input.identityVerified || !input.bankVerified) return null;\\nconst restricted = new Set([\"tobacco\", \"alcohol\", \"pharmacy\", \"weapons\", \"gambling\"]);\\nif (input.categories.some((category) => restricted.has(category))) return null;\\nreturn {\\n  businessName: input.businessName,\\n  description: input.description,\\n  categories: input.categories,\\n  country: input.country\\n};",
  "decide_js": "if (!input.identityVerified || !input.bankVerified) return \"reject\";\\nconst restricted = new Set([\"tobacco\", \"alcohol\", \"pharmacy\", \"weapons\", \"gambling\"]);\\nif (input.categories.some((category) => restricted.has(category))) return \"reject\";\\nconst answer = answers && answers.is_eligible_business;\\nif (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\") return \"review\";\\nconst APPROVE_THRESHOLD = 0.8;\\nconst REJECT_THRESHOLD = 0.2;\\nif (answer.noul >= APPROVE_THRESHOLD) return \"approve\";\\nif (answer.noul <= REJECT_THRESHOLD) return \"reject\";\\nreturn \"review\";",
  "notes": "Code immediately rejects applications that fail identity or bank verification or list an exact restricted category, without using the model. For other verified applications, the model judges whether the business is genuine, permitted, and accurately represented by the description and categories. A probability of at least 0.8 for eligibility approves, at most 0.2 rejects, and the intermediate band goes to review so unclear descriptions are not decided automatically."
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
