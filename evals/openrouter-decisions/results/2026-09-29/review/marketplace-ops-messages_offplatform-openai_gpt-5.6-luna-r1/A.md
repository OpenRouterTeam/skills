# marketplace-ops-messages_offplatform-openai_gpt-5.6-luna-r1

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate A

### Design

```json
{
  "questions": {
    "off_platform_intent": {
      "type": "noul",
      "instructions": "Does this message ask or suggest that the sender or recipient pay outside the platform, or continue the conversation outside the platform?",
      "criteria": {
        "true": "The message asks or suggests using an external payment method or moving communication to an external channel, including sharing or requesting contact details for that purpose.",
        "false": "The message only mentions an external service or contact method incidentally, denies using it, discusses a past or existing in-platform action, or does not propose moving payment or conversation outside the platform."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const urls = input.body.match(/https:\\/\\/\\S+|\\bwww\\.\\S+/gi)?.length ?? 0;\nconst phones = input.body.match(/\\+?\\d[\\d\\s().-]{7,}\\d/g)?.length ?? 0;\nreturn {\n  body: input.body,\n  fromAccountAgeDays: input.fromAccountAgeDays,\n  urlCount: urls,\n  phoneCount: phones\n};",
  "decide_js": "const urlCount = state && Number.isFinite(state.urlCount) ? state.urlCount : (input.body.match(/https:\\/\\/\\S+|\\bwww\\.\\S+/gi)?.length ?? 0);\nconst phoneCount = state && Number.isFinite(state.phoneCount) ? state.phoneCount : (input.body.match(/\\+?\\d[\\d\\s().-]{7,}\\d/g)?.length ?? 0);\nif (input.fromAccountAgeDays < 1 && (urlCount > 0 || phoneCount > 0)) return \"block\";\nif (urlCount > 0 || phoneCount > 0) return \"warn\";\nconst answer = answers && answers.off_platform_intent;\nif (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\" || !Number.isFinite(answer.noul)) return \"block\";\nif (answer.noul >= 0.7) return \"warn\";\nreturn \"deliver\";",
  "notes": "The decision model judges whether the message proposes paying or continuing the conversation outside the platform, while allowing incidental mentions or explicit denials. JavaScript extracts URLs and phone numbers with fixed regular expressions and warns for them; messages from accounts younger than one day that contain either are blocked. A model noul score of at least 0.7 produces a warning, and a missing or malformed decision is handled conservatively as block."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "body": "I paid through the app, not PayPal, so the receipt should be in your orders tab.",
      "fromAccountAgeDays": 120,
      "urlCount": 0,
      "phoneCount": 0
    },
    "answers": {
      "off_platform_intent": {
        "type": "noul",
        "noul": 0.04
      }
    },
    "action": "deliver",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "body": "Let's take this to my email, I will send you the address and we can sort the payment there and skip the fees.",
      "fromAccountAgeDays": 30,
      "urlCount": 0,
      "phoneCount": 0
    },
    "answers": {
      "off_platform_intent": {
        "type": "noul",
        "noul": 0.99
      }
    },
    "action": "warn",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "body": "Call me on 415 555 0100 to arrange pickup.",
      "fromAccountAgeDays": 0,
      "urlCount": 0,
      "phoneCount": 1
    },
    "answers": {
      "off_platform_intent": {
        "type": "noul",
        "noul": 0.91
      }
    },
    "action": "block",
    "error": null
  }
]
```
