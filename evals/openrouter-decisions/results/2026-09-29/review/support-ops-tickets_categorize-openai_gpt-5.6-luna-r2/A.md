# support-ops-tickets_categorize-openai_gpt-5.6-luna-r2

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
      "instructions": "Assign the ticket to the single category that best matches its primary customer intent. Judge the issue described in the ticket, not merely whether a word appears. Use general when no category clearly fits or when the ticket contains multiple equally prominent intents.",
      "criteria": {
        "billing": "The primary issue concerns charges, invoices, refunds, payments, cards, subscriptions, pricing, or other financial transactions.",
        "account_access": "The primary issue concerns signing in, logging in, passwords, password resets, two-factor authentication, permissions, or being locked out of an account.",
        "bug": "The customer reports that an existing product behavior is malfunctioning, broken, failing, producing an error, crashing, or behaving unexpectedly. This is for a current defect, not a request for a new capability.",
        "feature_request": "The customer requests a new capability, product change, enhancement, or improvement that is not primarily a report of an existing malfunction.",
        "general": "The ticket does not clearly fit billing, account_access, bug, or feature_request, including general questions, feedback without a concrete feature request, and equally mixed intents."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return { subject: String(input.subject || \"\"), body: String(input.body || \"\") };",
  "decide_js": "const answer = answers && answers.category;\nif (!answer || answer.type !== \"choice\") return \"general\";\nconst valid = new Set([\"billing\", \"account_access\", \"bug\", \"feature_request\", \"general\"]);\nreturn valid.has(answer.choice) ? answer.choice : \"general\";",
  "notes": "The decision model judges the ticket's primary intent among the five mutually exclusive categories using the subject and body; it is explicitly instructed to distinguish current malfunctions from feature requests and to use general for unclear or equally mixed cases. Code supplies only the relevant ticket text, validates the returned choice, and falls back to general if the response is missing, malformed, or outside the allowed action set. No numeric threshold is needed because this is a choice question."
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
          "billing": 1,
          "account_access": 0,
          "bug": 0,
          "feature_request": 0,
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
      "subject": "Feedback",
      "body": "Loving the product so far, just wanted to say thanks to the team."
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
