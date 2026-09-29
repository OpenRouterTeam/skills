# support-ops-tickets_categorize-z-ai_glm-5.3-flash-r2

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
      "instructions": "Which single category best describes this support ticket? Judge the customer's main concern from `subject` and `body`. If the ticket touches more than one category, pick the one that matches the main problem. If none of the four specific categories fits, choose general.",
      "criteria": {
        "billing": "The customer's main concern is money: a charge they question, an invoice, a refund, a payment method, a subscription, or pricing.",
        "account_access": "The customer's main concern is getting into their account: sign-in fails, the account is locked, or a password or two-factor step is not working.",
        "bug": "The customer's main concern is that the product misbehaves: an error, a crash, or a feature that does not do what it should. The customer is reporting a fault, not asking for something new.",
        "feature_request": "The customer's main concern is a request for something new or different that the product does not offer today.",
        "general": "None of the above fits: a question, comment, or request outside these categories."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const subject = typeof input.subject === 'string' ? input.subject.trim() : '';\nconst body = typeof input.body === 'string' ? input.body.trim() : '';\nif (!subject && !body) return null;\nreturn { subject: subject, body: body };",
  "decide_js": "const VALID = ['billing', 'account_access', 'bug', 'feature_request', 'general'];\nconst a = answers ? answers.category : undefined;\nif (!a || a.type !== 'choice' || typeof a.choice !== 'string') return 'general';\nreturn VALID.indexOf(a.choice) !== -1 ? a.choice : 'general';",
  "notes": "The model makes exactly one judgment: which of the five categories best matches the ticket's main concern, asked as a single `choice` (mutually exclusive labels, so one choice question rather than several nouls recombined in code), with the bug/feature boundary and the money-vs-fault boundary written into the criteria. Code computes everything else: it trims the subject and body, skips the model entirely and returns general when both are blank (a code-side fact that settles the action), builds the state from only the two fields the question reads (id and customerPlan stay out because no question reads them and no code rule consumes them), and reads the answer by checking `type === 'choice'` before taking the `choice` field, falling back to general only when the answer is missing, mistyped, or not one of the five valid keys. Per the pre-probe default the gate is the `choice` field itself with no probability threshold; a near-tie band that routes to general, or any confidence gate, should be introduced only after running the step 8 probe set (clear billing/access/bug/feature tickets, an ambiguous bug-or-billing ticket like a double charge, a no-match ticket, an empty input, a negation, and text that argues its own category) and setting thresholds from the observed probabilities, since thresholds do not carry between models."
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
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team."
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
