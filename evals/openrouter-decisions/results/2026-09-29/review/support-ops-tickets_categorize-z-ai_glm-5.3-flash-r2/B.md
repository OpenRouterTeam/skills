# support-ops-tickets_categorize-z-ai_glm-5.3-flash-r2

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
      "instructions": "Which category best describes this support ticket? Consider the subject and body together, and the customer's plan only as context for urgency of tone, not for the category itself.",
      "criteria": {
        "billing": "The customer is reporting or asking about charges, invoices, refunds, payments, cards, subscriptions, or pricing — including being charged incorrectly or wanting money back.",
        "account_access": "The customer cannot sign in or access their account: login problems, password or 2FA issues, lockouts, or account recovery.",
        "bug": "The customer reports the product malfunctioning: errors, crashes, broken behavior, blank screens, failed actions, or unexpected results.",
        "feature_request": "The customer asks for new functionality, an enhancement, or a change to how something works, rather than reporting a malfunction.",
        "general": "None of the above: general questions, how-to requests, feedback, or anything that does not fit the other categories."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return {\n  ticket_id: input.id,\n  subject: input.subject,\n  body: input.body,\n  customer_plan: input.customerPlan\n};",
  "decide_js": "const a = answers.category;\nif (!a || a.type !== 'choice') return 'general';\nconst p = a.probabilities || {};\nconst top = a.choice;\nconst known = ['billing', 'account_access', 'bug', 'feature_request', 'general'];\nif (known.indexOf(top) === -1) return 'general';\nconst conf = typeof a.confidence === 'number' ? a.confidence : (p[top] || 0);\nif (conf < 0.5) return 'general';\nreturn top;",
  "notes": "The model judges which of the five categories best fits the ticket using the subject, body, and plan as state; the criteria descriptions spell out the boundary between bug (malfunction) and feature_request (enhancement), and route money-related complaints to billing and sign-in problems to account_access. The code builds the state from the InboundTicket fields and, in decide_js, validates that the answer is a choice whose value is one of the five known categories, treats a missing or unexpected answer type as an error by falling back to general, and applies a confidence threshold of 0.5 (using the answer's confidence field, falling back to the chosen option's probability) so low-certainty classifications land in general instead of a possibly wrong specific category."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket_id": "T-1041",
      "subject": "Charged twice this month",
      "body": "My card shows two charges of $49 on the 3rd. I only have one workspace. Can you look into it?",
      "customer_plan": "pro"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "billing",
        "probabilities": {
          "feature_request": 0,
          "bug": 0,
          "account_access": 0,
          "general": 0,
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
      "ticket_id": "T-1042",
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team.",
      "customer_plan": "free"
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "general",
        "probabilities": {
          "feature_request": 0,
          "billing": 0,
          "bug": 0,
          "general": 1,
          "account_access": 0
        },
        "confidence": 1
      }
    },
    "action": "general",
    "error": null
  }
]
```
