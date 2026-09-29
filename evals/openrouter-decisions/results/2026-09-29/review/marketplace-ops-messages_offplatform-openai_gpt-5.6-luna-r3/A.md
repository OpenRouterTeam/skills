# marketplace-ops-messages_offplatform-openai_gpt-5.6-luna-r3

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate A

### Design

```json
{
  "questions": {
    "asks_off_platform": {
      "type": "noul",
      "instructions": "Does this message ask the recipient to pay outside the platform or ask to continue the conversation outside the platform?",
      "criteria": {
        "true": "The message proposes, requests, or directs an off-platform payment or off-platform communication, including offering to move the conversation to email, phone, messaging apps, or another service.",
        "false": "The message does not make such a request. A message that merely mentions an outside payment service while explicitly saying payment was made through the platform is false."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst urls = input.body.match(URL_PATTERN)?.length ?? 0;\nconst phones = input.body.match(PHONE_PATTERN)?.length ?? 0;\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return null;\nreturn { body: input.body };",
  "decide_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst urls = input.body.match(URL_PATTERN)?.length ?? 0;\nconst phones = input.body.match(PHONE_PATTERN)?.length ?? 0;\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return \"block\";\nif (urls + phones > 0) return \"warn\";\nconst answer = answers.asks_off_platform;\nif (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\") throw new Error(\"Invalid asks_off_platform decision\");\nconst OFF_PLATFORM_THRESHOLD = 0.5;\nreturn answer.noul >= OFF_PLATFORM_THRESHOLD ? \"warn\" : \"deliver\";",
  "notes": "The decision model judges the message's intent: whether it asks for payment or conversation outside the platform, rather than matching payment-service terms. Code extracts URLs and phone numbers, preserves the hard block for accounts younger than one day when either is present, and warns for URLs or phone numbers otherwise. A model noul probability of at least 0.5 produces warn; otherwise the message is delivered."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "body": "I paid through the app, not PayPal, so the receipt should be in your orders tab."
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
      "body": "Let's take this to my email, I will send you the address and we can sort the payment there and skip the fees."
    },
    "answers": {
      "asks_off_platform": {
        "type": "noul",
        "noul": 0.98
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
