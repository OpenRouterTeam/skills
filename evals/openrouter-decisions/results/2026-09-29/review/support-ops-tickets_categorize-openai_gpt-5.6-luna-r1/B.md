# support-ops-tickets_categorize-openai_gpt-5.6-luna-r1

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
      "instructions": "Assign the inbound support ticket its single primary category based on the customer's actual request and problem. Use general when none of the specific categories clearly applies.",
      "criteria": {
        "billing": "The ticket is primarily about charges, invoices, refunds, payments, cards, subscriptions, pricing, or other billing/account-finance matters.",
        "account_access": "The ticket is primarily about logging in, signing in, passwords, authentication, two-factor authentication, account lockout, or inability to access an account.",
        "bug": "The ticket is primarily reporting unexpected, defective, broken, crashed, failed, or erroneous behavior in an existing product capability. Do not use this for a request to add or improve functionality.",
        "feature_request": "The ticket is primarily asking for a new capability, enhancement, change, or product improvement, including suggestions or requests to add functionality.",
        "general": "The ticket does not clearly fit billing, account_access, bug, or feature_request, or is mainly a general question or request."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: input.subject, body: input.body };",
  "decide_js": "const answer = answers && answers.category;\\nif (!answer || answer.type !== \"choice\") return \"general\";\\nconst allowed = new Set([\"billing\", \"account_access\", \"bug\", \"feature_request\", \"general\"]);\\nreturn allowed.has(answer.choice) ? answer.choice : \"general\";",
  "notes": "The decision model assigns the ticket's primary category from the subject and body using mutually exclusive category criteria, including an explicit general fallback. Code supplies only the relevant ticket text, validates the returned choice, and falls back to general for missing or malformed answers; no numeric threshold is needed."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "subject": "Charged twice this month",
      "body": "My card shows two charges of $49 on the 3rd. I only have one workspace. Can you look into it?"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "billing",
        "probabilities": {
          "general": 0,
          "billing": 1,
          "account_access": 0,
          "feature_request": 0,
          "bug": 0
        },
        "confidence": 1
      }
    },
    "action": null,
    "error": "Invalid or unexpected token"
  },
  {
    "skipped_model": false,
    "state": {
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team."
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "general",
        "probabilities": {
          "account_access": 0,
          "bug": 0,
          "billing": 0,
          "feature_request": 0,
          "general": 1
        },
        "confidence": 1
      }
    },
    "action": null,
    "error": "Invalid or unexpected token"
  }
]
```
