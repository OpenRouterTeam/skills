# support-ops-tickets_categorize-z-ai_glm-5.3-flash-r1

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
      "instructions": "Classify this support ticket into exactly one category based on the customer's primary intent. If more than one category could apply, choose the one that covers the main problem the customer wants solved.",
      "criteria": {
        "billing": "Money or plan administration: charges, invoices, refunds, payment methods, cards, subscriptions, upgrades, or pricing.",
        "account_access": "Getting into or managing the account: login or sign-in failures, locked accounts, password resets, two-factor authentication, permissions, or profile settings.",
        "bug": "The product malfunctioning: errors, crashes, blank or broken pages, wrong results, or anything that does not work as intended.",
        "feature_request": "Asking for something the product does not do yet: new functionality, enhancements, or suggestions for how it should work.",
        "general": "Anything else, including how-to questions, feedback, and tickets too vague to classify."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return {\n  ticket_id: input.id,\n  customer_plan: input.customerPlan,\n  subject: input.subject,\n  body: input.body\n};",
  "decide_js": "const VALID = ['billing', 'account_access', 'bug', 'feature_request', 'general'];\nconst a = answers.category;\nif (!a || a.type !== 'choice') return 'general';\nif (VALID.indexOf(a.choice) === -1) return 'general';\nlet confidence = null;\nif (typeof a.confidence === 'number') {\n  confidence = a.confidence;\n} else if (a.probabilities && typeof a.probabilities[a.choice] === 'number') {\n  confidence = a.probabilities[a.choice];\n}\nif (confidence !== null && confidence < 0.5) return 'general';\nreturn a.choice;",
  "notes": "The model does the categorization: one fixed choice question has it read the ticket's subject and body (with the customer's plan included in the state for context) and pick the customer's primary intent among billing, account_access, bug, feature_request, and general, with per-option criteria and general as the explicit catch-all. The code only builds the state and validates the answer: it requires answers.category to exist with type 'choice' and a choice that is one of the five category strings, reads confidence through a presence check (falling back to the chosen option's probability when confidence is absent), and returns 'general' whenever the answer is missing, has an unexpected type, carries an unknown label, or confidence is below 0.5 — mirroring the old heuristic's no-hit/tie fallback so ambiguous tickets land in general rather than a wrong queue. Because the option set never varies per input, questions is static and no build_questions_js is needed; build_state_js never returns null, so there is exactly one Decisions request per ticket."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket_id": "T-1041",
      "customer_plan": "pro",
      "subject": "Charged twice this month",
      "body": "My card shows two charges of $49 on the 3rd. I only have one workspace. Can you look into it?"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "billing",
        "probabilities": {
          "billing": 1,
          "feature_request": 0,
          "bug": 0,
          "account_access": 0,
          "general": 0
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
      "ticket_id": "T-1042",
      "customer_plan": "free",
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team."
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "general",
        "probabilities": {
          "billing": 0,
          "feature_request": 0,
          "account_access": 0,
          "general": 1,
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
