# support-ops-tickets_categorize-openai_gpt-5.6-luna-r2

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
      "instructions": "Assign the ticket to exactly one category based on its primary customer intent. Use billing for charges, invoices, refunds, payment methods, subscriptions, or pricing. Use account_access for login, password, sign-in, two-factor authentication, permissions, or being locked out. Use bug for broken or unexpected existing behavior, errors, crashes, failed operations, or defects. Use feature_request when the customer asks for a new capability, enhancement, or product change that is not primarily reporting a defect. Use general when none of the other categories clearly applies.",
      "criteria": {
        "billing": "The ticket is primarily about charges, invoices, refunds, payment methods, subscriptions, or pricing.",
        "account_access": "The ticket is primarily about login, password, sign-in, two-factor authentication, permissions, or being locked out.",
        "bug": "The ticket primarily reports broken or unexpected existing behavior, an error, crash, failed operation, or other defect.",
        "feature_request": "The ticket primarily requests a new capability, enhancement, or product change rather than reporting a defect.",
        "general": "The ticket does not clearly fit billing, account access, bug, or feature request."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body, customerPlan: input.customerPlan };",
  "decide_js": "const answer = answers && answers.category;\nconst allowed = new Set([\"billing\", \"account_access\", \"bug\", \"feature_request\", \"general\"]);\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") return \"general\";\nreturn allowed.has(answer.choice) ? answer.choice : \"general\";",
  "notes": "The model assigns the ticket's primary intent using a single choice question with explicit criteria for all five allowed actions. The JavaScript passes the subject, body, and customer plan as structured state, validates the returned answer type and category, and uses general only when the response is missing, malformed, or outside the allowed set. No confidence threshold is applied because the model's explicit category choice is the classification signal."
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
          "general": 0,
          "billing": 1,
          "feature_request": 0,
          "account_access": 0,
          "bug": 0
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
          "account_access": 0,
          "billing": 0,
          "general": 1,
          "feature_request": 0,
          "bug": 0
        },
        "confidence": 1
      }
    },
    "action": "general",
    "error": null
  }
]
```
