# support-ops-tickets_categorize-openai_gpt-5.6-luna-r3

Site: `src/tickets/categorize.ts`

Brief given to both authors:

> Replace the keyword heuristic in categorize() so the ticket is assigned one of billing, account_access, bug, feature_request, or general.

## Candidate B

### Design

```json
{
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "Assign this support ticket to exactly one category based on its primary reason. Choose billing for charges, invoices, refunds, payment methods, subscriptions, or pricing. Choose account_access for login, sign-in, password, two-factor authentication, permissions, or being locked out. Choose bug for unexpected, broken, erroneous, crashed, or malfunctioning existing product behavior. Choose feature_request when the customer requests a new capability or enhancement that is not reporting broken existing behavior. Choose general when none of the other categories clearly applies.",
      "criteria": {
        "billing": "The ticket primarily concerns charges, invoices, refunds, payment methods, subscriptions, or pricing.",
        "account_access": "The ticket primarily concerns login, sign-in, passwords, two-factor authentication, permissions, or account access.",
        "bug": "The ticket reports unexpected, broken, erroneous, crashed, or malfunctioning existing product behavior.",
        "feature_request": "The ticket requests a new capability or enhancement rather than reporting broken existing behavior.",
        "general": "The ticket does not clearly fit billing, account access, a bug, or a feature request."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body, customerPlan: input.customerPlan };",
  "decide_js": "const answer = answers && answers.category;\nconst allowed = [\"billing\", \"account_access\", \"bug\", \"feature_request\", \"general\"];\nif (!answer || answer.type !== \"choice\" || !allowed.includes(answer.choice)) return \"general\";\nif (typeof answer.confidence === \"number\" && answer.confidence < 0.5) return \"general\";\nreturn answer.choice;",
  "notes": "The model assigns each ticket to exactly one of the five categories using the subject, body, and customer plan, with instructions that distinguish broken existing behavior from enhancement requests and prioritize the ticket's primary reason. JavaScript validates the answer type and allowed action, and falls back to general for malformed or low-confidence answers (confidence below 0.5)."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "subject": "Charged twice this month",
      "body": "My card shows two charges of $49 on the 3rd. I only have one workspace. Can you look into it?",
      "customerPlan": "pro"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "billing",
        "probabilities": {
          "bug": 0,
          "billing": 1,
          "general": 0,
          "account_access": 0,
          "feature_request": 0
        },
        "confidence": 1
      }
    },
    "action": "billing",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team.",
      "customerPlan": "free"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "general",
        "probabilities": {
          "bug": 0,
          "account_access": 0,
          "general": 1,
          "billing": 0,
          "feature_request": 0
        },
        "confidence": 1
      }
    },
    "action": "general",
    "error": null
  }
]
```
