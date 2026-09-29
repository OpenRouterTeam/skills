# marketplace-ops-messages_offplatform-openai_gpt-5.6-luna-r3

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate B

### Design

```json
{
  "questions": {
    "off_platform_intent": {
      "type": "noul",
      "instructions": "Does this message ask or propose paying outside the platform, or continuing the conversation outside the platform?",
      "criteria": {
        "true": "The message requests, suggests, or meaningfully proposes an off-platform payment method or moving communication to email, phone, text, another app, or another external channel. A mere mention of an external service while explicitly saying the transaction or conversation remains on the platform is not enough.",
        "false": "The message does not ask or propose an off-platform payment or off-platform communication."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const body = String(input.body);\nconst urls = body.match(/https?:\\/\\/\\S+|\\bwww\\.\\S+/gi)?.length ?? 0;\nconst phones = body.match(/\\+?\\d[\\d\\s().-]{7,}\\d/g)?.length ?? 0;\nreturn {\n  body,\n  fromAccountAgeDays: input.fromAccountAgeDays,\n  urls,\n  phones\n};",
  "decide_js": "if (!state || typeof state !== \"object\") throw new Error(\"missing screening state\");\nconst answer = answers && answers.off_platform_intent;\nif (!answer || answer.type !== \"noul\") throw new Error(\"missing or unexpected off_platform_intent answer type\");\nif (typeof answer.noul !== \"number\" || !Number.isFinite(answer.noul)) throw new Error(\"invalid noul answer\");\nif (state.fromAccountAgeDays < 1 && (state.urls > 0 || state.phones > 0)) return \"block\";\nif (answer.noul >= 0.5) return \"warn\";\nif (state.urls + state.phones > 0) return \"warn\";\nreturn \"deliver\";",
  "notes": "The decision model judges whether the message proposes an off-platform payment or moving communication to an external channel, rather than matching a fixed term list. JavaScript extracts URLs and phone numbers with the existing patterns and applies the new-account rule first: accounts younger than one day with either extraction are blocked. Otherwise, model intent at or above 0.5 warns, and any URL or phone number also warns; all other messages are delivered."
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
      "urls": 0,
      "phones": 0
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
      "urls": 0,
      "phones": 0
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
      "urls": 0,
      "phones": 1
    },
    "answers": {
      "off_platform_intent": {
        "type": "noul",
        "noul": 0.95
      }
    },
    "action": "block",
    "error": null
  }
]
```
