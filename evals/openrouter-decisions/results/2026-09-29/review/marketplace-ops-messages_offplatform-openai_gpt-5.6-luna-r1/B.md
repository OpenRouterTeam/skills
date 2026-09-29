# marketplace-ops-messages_offplatform-openai_gpt-5.6-luna-r1

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate B

### Design

```json
{
  "questions": {
    "asks_off_platform": {
      "type": "noul",
      "instructions": "Does the message ask, suggest, or propose paying outside the platform or continuing the conversation outside the platform? Judge the intent of the message, not whether it merely mentions an off-platform service.",
      "criteria": {
        "true": "The message asks or proposes an off-platform payment, or asks or proposes moving the conversation to email, phone, another app, or another channel.",
        "false": "The message does not make that proposal, including messages that merely mention an off-platform service, report an existing in-platform payment, explicitly reject off-platform payment, or discuss an unrelated topic."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst urls = input.body.match(URL_PATTERN)?.length ?? 0;\nconst phones = input.body.match(PHONE_PATTERN)?.length ?? 0;\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return null;\nreturn { message: { body: input.body }, urls, phones };",
  "decide_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst urls = input.body.match(URL_PATTERN)?.length ?? 0;\nconst phones = input.body.match(PHONE_PATTERN)?.length ?? 0;\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return \"block\";\nconst answer = answers.asks_off_platform;\nif (answer && answer.type === \"noul\" && answer.noul >= 0.5) return \"warn\";\nif (urls + phones > 0) return \"warn\";\nreturn \"deliver\";",
  "notes": "The decision model judges whether the message proposes off-platform payment or moving the conversation off-platform, while its criteria explicitly distinguish intent from merely mentioning PayPal or describing an in-platform payment. JavaScript computes URL and phone matches and preserves the existing behavior of warning for those matches. A message from an account younger than one day with a URL or phone number is blocked before making a model request. The model's noul is treated as affirmative at the default 0.5 threshold; otherwise the action is warn when code finds a URL or phone and deliver when neither signal is present."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "message": {
        "body": "I paid through the app, not PayPal, so the receipt should be in your orders tab."
      },
      "urls": 0,
      "phones": 0
    },
    "answers": {
      "asks_off_platform": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "deliver",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "message": {
        "body": "Let's take this to my email, I will send you the address and we can sort the payment there and skip the fees."
      },
      "urls": 0,
      "phones": 0
    },
    "answers": {
      "asks_off_platform": {
        "type": "noul",
        "noul": 0.99
      }
    },
    "action": "warn",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "block",
    "error": null
  }
]
```
