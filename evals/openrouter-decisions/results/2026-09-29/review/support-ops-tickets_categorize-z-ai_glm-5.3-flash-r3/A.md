# support-ops-tickets_categorize-z-ai_glm-5.3-flash-r3

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
      "instructions": "Classify this support ticket into exactly one category, judging the ticket described in `subject` and `body`. A report that existing functionality fails, errors, crashes, or produces wrong results is a bug. A request to add new functionality or change how the product works is a feature_request, even when it mentions something working poorly. Anything about charges, invoices, refunds, payment methods, cards, subscriptions, or pricing is billing. Anything about signing in, passwords, two-factor authentication, being locked out, or recovering the account is account_access. Choose general only when none of the other categories fit.",
      "criteria": {
        "billing": "The ticket is about charges, invoices, refunds, payments, cards, subscriptions, or pricing.",
        "account_access": "The ticket is about signing in, passwords, two-factor authentication, being locked out, or recovering the account.",
        "bug": "The ticket reports existing functionality failing, erroring, crashing, or producing wrong results.",
        "feature_request": "The ticket asks for new functionality or a change to how the product works.",
        "general": "The ticket fits none of the categories above."
      }
    }
  },
  "build_questions_js": "",
  "build_state_js": "const subject = typeof input.subject === 'string' ? input.subject.trim() : '';\nconst body = typeof input.body === 'string' ? input.body.trim() : '';\nif (!subject && !body) return null;\nreturn { subject: subject, body: body };",
  "decide_js": "const VALID = ['billing', 'account_access', 'bug', 'feature_request', 'general'];\nconst answer = answers.category;\nif (answer && answer.type === 'choice' && VALID.indexOf(answer.choice) !== -1) {\n  return answer.choice;\n}\nreturn 'general';",
  "notes": "The model makes one judgment: which of the five categories the ticket belongs to, sent as a single choice question over the full label set, with general doubling as the no-match option; the instructions carry the bug-vs-feature_request boundary (broken existing behavior vs. requested change) since that is where keyword counting failed. Code computes everything else: build_state_js skips the model entirely when subject and body are both empty (decide_js then returns general), sends only subject and body because customerPlan and id are read by no question and the plan feeds no categorization rule, and decide_js validates the answer's type and label, returning the choice field directly (the pre-probe default gate for a choice) and falling back to general only when the answer is missing, malformed, or outside the label set, which in production should log the response model rather than pass silently. No threshold is imposed on probabilities or confidence yet: a low-confidence band that defers near-ties to general, replacing the old tie-to-general rule, must wait for step 8 probes over clear cases, an ambiguous bug-vs-feature request, a no-match ticket, a negated report such as 'login works fine now', and adversarial text arguing for its own category, with the model pinned to a canonical_slug and the response model logged with each stored answer."
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
    "answers": {},
    "action": null,
    "error": "build_questions_js returned null, not an object"
  },
  {
    "skipped_model": false,
    "state": {
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team."
    },
    "answers": {},
    "action": null,
    "error": "build_questions_js returned null, not an object"
  }
]
```
