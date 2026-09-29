# support-ops-tickets_categorize-openai_gpt-5.6-luna-r1

Site: `src/tickets/categorize.ts`

Brief given to both authors:

> Replace the keyword heuristic in categorize() so the ticket is assigned one of billing, account_access, bug, feature_request, or general.

## Candidate A

### Design

```json
{
  "questions": {
    "category": {
      "type": "choice",
      "instructions": "Assign this support ticket to exactly one category. Choose billing for charges, invoices, refunds, payment methods, subscriptions, or pricing. Choose account_access for login, sign-in, password, two-factor authentication, permissions, or being locked out. Choose bug for broken, incorrect, failed, crashed, or unexpected existing behavior. Choose feature_request when the customer asks for a new capability or enhancement. Choose general when none of the other categories clearly applies.",
      "criteria": {
        "billing": "The ticket concerns charges, duplicate charges, invoices, refunds, payment methods, subscriptions, billing, or pricing.",
        "account_access": "The ticket concerns logging in, signing in, passwords, two-factor authentication, permissions, or being locked out of an account.",
        "bug": "The ticket reports broken, failed, incorrect, crashed, or otherwise unexpected behavior in an existing product capability.",
        "feature_request": "The customer requests a new feature, capability, enhancement, or product change rather than reporting a malfunction.",
        "general": "The ticket does not clearly fit billing, account access, a product bug, or a feature request."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { id: input.id, subject: input.subject, body: input.body, customerPlan: input.customerPlan };",
  "decide_js": "const answer = answers && answers.category;\nconst valid = new Set([\"billing\", \"account_access\", \"bug\", \"feature_request\", \"general\"]);\nif (!answer || answer.type !== \"choice\" || !valid.has(answer.choice)) return \"general\";\nif (Object.prototype.hasOwnProperty.call(answer, \"confidence\") && (typeof answer.confidence !== \"number\" || answer.confidence < 0.55)) return \"general\";\nif (Object.prototype.hasOwnProperty.call(answer, \"probabilities\")) {\n  const probability = answer.probabilities && answer.probabilities[answer.choice];\n  if (typeof probability !== \"number\" || probability < 0.55) return \"general\";\n}\nreturn answer.choice;",
  "notes": "The model judges which of the five mutually exclusive support categories best matches the subject and body, with the customer plan included as context. The JavaScript validates the choice and, when the API supplies optional confidence or probability metadata, requires the selected category to meet a 0.55 confidence threshold; malformed, missing, or ambiguous answers fall back to general."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "id": "T-1041",
      "subject": "Charged twice this month",
      "body": "My card shows two charges of $49 on the 3rd. I only have one workspace. Can you look into it?",
      "customerPlan": "pro"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "billing",
        "probabilities": {
          "general": 0,
          "account_access": 0,
          "bug": 0,
          "feature_request": 0,
          "billing": 1
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
      "id": "T-1042",
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team.",
      "customerPlan": "free"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "general",
        "probabilities": {
          "account_access": 0,
          "feature_request": 0,
          "billing": 0,
          "bug": 0,
          "general": 1
        },
        "confidence": 1
      }
    },
    "action": "general",
    "error": null
  }
]
```
