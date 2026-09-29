# marketplace-ops-messages_offplatform-openai_gpt-5.6-luna-r2

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
      "instructions": "Does this message ask the recipient to pay outside the platform or ask to continue the conversation or exchange contact details outside the platform?",
      "criteria": {
        "true": "The message requests, proposes, or directs an off-platform payment or off-platform conversation/contact exchange. Mere mentions, denials, warnings, or reports of an existing in-platform payment do not count.",
        "false": "The message does not ask or propose moving payment or conversation/contact exchange off the platform."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst body = String(input.body || '');\nreturn {\n  body,\n  fromAccountAgeDays: Number(input.fromAccountAgeDays),\n  urlCount: body.match(URL_PATTERN)?.length ?? 0,\n  phoneCount: body.match(PHONE_PATTERN)?.length ?? 0\n};",
  "decide_js": "if (!answers || !answers.off_platform_intent || answers.off_platform_intent.type !== 'noul' || typeof answers.off_platform_intent.noul !== 'number') throw new Error('Invalid off-platform intent answer');\nconst urls = Number(state?.urlCount || 0);\nconst phones = Number(state?.phoneCount || 0);\nconst hasContactData = urls + phones > 0;\nif (Number(input.fromAccountAgeDays) < 1 && hasContactData) return 'block';\nif (answers.off_platform_intent.noul >= 0.5 || hasContactData) return 'warn';\nreturn 'deliver';",
  "notes": "The decision model judges whether the message requests or proposes an off-platform payment or conversation/contact exchange, while treating mere mentions or denials as non-intent. JavaScript extracts URLs and phone numbers with fixed regular expressions, blocks messages from accounts younger than one day when either is present, and warns for any remaining URL/phone occurrence or model-positive intent. A noul score of at least 0.5 is treated as positive."
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
        "noul": 0.03
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
        "noul": 0.98
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
        "noul": 0.93
      }
    },
    "action": "block",
    "error": null
  }
]
```
