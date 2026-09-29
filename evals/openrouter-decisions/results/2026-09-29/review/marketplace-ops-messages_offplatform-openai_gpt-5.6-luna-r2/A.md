# marketplace-ops-messages_offplatform-openai_gpt-5.6-luna-r2

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
      "instructions": "Does this message ask or encourage the recipient to pay outside the platform or to continue the conversation outside the platform? Judge the message's intended request, not merely whether it mentions an outside service or contact method.",
      "criteria": {
        "true": "The message asks or encourages the recipient to use an external payment method, avoid platform payment, move the conversation to external contact, or continue communication outside the platform.",
        "false": "The message does not make that request. This includes merely mentioning or denying use of an outside service, stating that payment was made through the platform, discussing platform policy, or providing ordinary in-platform instructions."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst body = String(input.body ?? '');\nconst urls = body.match(URL_PATTERN)?.length ?? 0;\nconst phones = body.match(PHONE_PATTERN)?.length ?? 0;\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return null;\nreturn { message: body };",
  "decide_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst body = String(input.body ?? '');\nconst urls = body.match(URL_PATTERN)?.length ?? 0;\nconst phones = body.match(PHONE_PATTERN)?.length ?? 0;\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return 'block';\nif (urls > 0 || phones > 0) return 'warn';\nconst answer = answers && answers.off_platform_intent;\nif (answer && answer.type === 'noul' && typeof answer.noul === 'number' && answer.noul >= 0.5) return 'warn';\nreturn 'deliver';",
  "notes": "The decision model judges whether the message asks or encourages payment or continued conversation outside the platform, including handling negated mentions such as stating that payment was made through the app. JavaScript keeps URL and phone extraction deterministic and preserves their warning behavior; a message from an account younger than one day containing either is blocked before any model request. The model's noul result uses the default 0.5 yes threshold, while malformed or missing model answers fall back to deliver when no URL or phone was extracted."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "message": "I paid through the app, not PayPal, so the receipt should be in your orders tab."
    },
    "answers": {
      "off_platform_intent": {
        "type": "noul",
        "noul": 0.02
      }
    },
    "action": "deliver",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "message": "Let's take this to my email, I will send you the address and we can sort the payment there and skip the fees."
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
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "block",
    "error": null
  }
]
```
