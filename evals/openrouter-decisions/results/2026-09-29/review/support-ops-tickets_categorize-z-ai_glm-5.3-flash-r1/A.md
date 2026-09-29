# support-ops-tickets_categorize-z-ai_glm-5.3-flash-r1

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
      "instructions": "Which category best describes this support ticket? Judge the customer's main concern from the subject and body, not individual words. A concern about charges, refunds, or pricing is billing even if a software defect may have caused it. Trouble getting into the account is account_access even if it surfaces as an error message. Existing behavior that is broken or wrong is a bug; asking for something new or different is a feature_request. If none of the four specific categories fits, choose general.",
      "criteria": {
        "billing": "The customer's main concern is money: a charge, invoice, refund, payment method, card, subscription, or price on their account.",
        "account_access": "The customer's main concern is reaching their account: signing in, a locked or disabled account, a password, or two-factor authentication.",
        "bug": "The customer reports that the product's existing behavior is broken, wrong, or failing: errors, crashes, or something that does not work as intended.",
        "feature_request": "The customer asks for new functionality or a change to how the product works, rather than reporting something broken.",
        "general": "None of the above: a question, comment, or request that does not fit billing, account_access, bug, or feature_request."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const subject = typeof input.subject === 'string' ? input.subject.trim() : '';\nconst body = typeof input.body === 'string' ? input.body.trim() : '';\nif (!subject && !body) {\n  return null;\n}\nreturn { subject: subject, body: body };",
  "decide_js": "const VALID = ['billing', 'account_access', 'bug', 'feature_request', 'general'];\nconst answer = answers.category;\nif (answer && answer.type === 'choice' && VALID.indexOf(answer.choice) !== -1) {\n  return answer.choice;\n}\nreturn 'general';",
  "notes": "The model makes the one judgment the keyword heuristic was faking: which of the five categories matches the ticket's main concern, asked as a single choice over the five labels with general serving as the no-match option. The instructions carry the boundary rules the old word lists could not express: a disputed charge is billing even if a defect caused it, a sign-in failure is account_access even when it shows an error message, and broken existing behavior is a bug while a request for something new is a feature_request. Code keeps everything deterministic: build_state_js returns null for a ticket with no text so the model is skipped entirely and decide_js returns general for that path; state carries only subject and body because no question reads customerPlan or id; and decide_js checks the answer's type and value before returning the choice, falling back to general only when the answer is missing or malformed (in production that branch should log and escalate rather than silently default). No threshold beyond the choice field itself, per the pre-probe default; after running a probe set through decide.ts --compare (clear cases of each category, an ambiguous bug-vs-feature ticket, a defect-caused billing dispute, a negated statement, and adversarial keyword-stuffed text), add a named low-confidence constant that routes a weak top probability to general, and pin the probed canonical_slug in config, logging the response model with each stored answer."
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
          "bug": 0,
          "feature_request": 0,
          "account_access": 0
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
          "general": 1,
          "bug": 0,
          "feature_request": 0,
          "account_access": 0,
          "billing": 0
        },
        "confidence": 1
      }
    },
    "action": "general",
    "error": null
  }
]
```
