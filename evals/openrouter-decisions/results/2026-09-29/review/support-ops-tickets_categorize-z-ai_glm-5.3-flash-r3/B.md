# support-ops-tickets_categorize-z-ai_glm-5.3-flash-r3

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
      "instructions": "Classify this customer support ticket into exactly one category based on what the customer needs.",
      "criteria": {
        "billing": "Issues about charges, invoices, refunds, payments, cards, subscriptions, or pricing.",
        "account_access": "Trouble signing in, passwords, two-factor authentication, locked or suspended accounts, or profile and permission problems.",
        "bug": "Reports that the product errors, crashes, or behaves in a broken or unexpected way.",
        "feature_request": "Requests or suggestions for new functionality or changes to how the product works.",
        "general": "Anything that does not clearly fit the other categories, such as general questions or feedback."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return {\n  ticket_id: input.id,\n  customer_plan: input.customerPlan,\n  subject: input.subject,\n  body: input.body\n};",
  "decide_js": "const VALID = ['billing', 'account_access', 'bug', 'feature_request', 'general'];\nconst answer = answers.category;\nif (!answer || answer.type !== 'choice') {\n  throw new Error('categorize: missing or unexpected type for answer \"category\"');\n}\nif (VALID.indexOf(answer.choice) === -1) {\n  throw new Error('categorize: model returned unknown category ' + JSON.stringify(answer.choice));\n}\nif (typeof answer.confidence === 'number' && answer.confidence < 0.35) {\n  return 'general';\n}\nreturn answer.choice;",
  "notes": "The model makes the entire routing judgment in a single choice question: it reads the ticket's subject, body, and plan from the state and picks one of the five fixed categories, each described by the kind of ticket it covers. Because the option set never varies per input, a static questions object suffices (no build_questions_js) and the integration stays at one Decisions request per ticket. build_state_js just projects the InboundTicket into named fields, which the API prefers. decide_js enforces the response contract: it throws if the 'category' answer is missing or carries an unexpected type, and throws if the choice value is not one of the five allowed categories, rather than silently defaulting. Confidence and probabilities are optional in the schema, so confidence is read through a typeof presence check; when present and below 0.35 the ticket falls back to 'general', mirroring the old heuristic's no-hit/tie behavior. Otherwise the model's choice is returned as the action."
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
          "bug": 0,
          "feature_request": 0,
          "general": 0,
          "account_access": 0,
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
      "customer_plan": "free",
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team."
    },
    "answers": {
      "category": {
        "type": "choice",
        "choice": "general",
        "probabilities": {
          "bug": 0,
          "feature_request": 0,
          "general": 1,
          "billing": 0,
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
