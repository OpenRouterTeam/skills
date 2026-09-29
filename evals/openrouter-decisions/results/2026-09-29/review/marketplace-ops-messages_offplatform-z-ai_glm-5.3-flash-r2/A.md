# marketplace-ops-messages_offplatform-z-ai_glm-5.3-flash-r2

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate A

### Design

```json
{
  "questions": {
    "payOffPlatform": {
      "type": "noul",
      "instructions": "Judging a marketplace message between a buyer and seller. Does the message try to steer the other person into making a payment somewhere other than this platform? Do not count mere mentions of payment services for context, comparisons like 'through the app, not PayPal', or talk about a purchase already completed on the platform. Count requests, offers, or suggestions to pay by wire, bank transfer, cash app, gift card, cryptocurrency, direct deposit, or any other route that bypasses the platform.",
      "criteria": {
        "true": "The message proposes, requests, or suggests that a payment happen through a channel other than this platform.",
        "false": "There is no attempt to redirect payment away from the platform, including messages that only mention or compare payment methods for transactions already handled here."
      }
    },
    "moveOffPlatform": {
      "type": "noul",
      "instructions": "Judging a marketplace message between a buyer and seller. Does the message invite the other person to continue the conversation or finish arranging things somewhere other than this platform, such as email, SMS/text, WhatsApp, Telegram, Signal, social media DMs, or another site? Do not count simply containing an email address, link, or phone number without urging the other side to switch over there.",
      "criteria": {
        "true": "The message asks, invites, or suggests that future communication or coordination happens outside this platform.",
        "false": "The message keeps everything on the platform, even if it includes external-looking details without encouraging a switch to them."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "return {\n  messageId: input.id,\n  senderAccountAgeDays: input.fromAccountAgeDays,\n  messageBody: input.body\n};",
  "decide_js": "// Hard rule kept in code: brand-new accounts pushing contact info get blocked outright.\nvar urls = (input.body.match(/https?:\\/\\/\\S+|\\bwww\\.\\S+/gi) || []).length;\nvar phones = (input.body.match(/\\+?\\d[\\d\\s().-]{7,}\\d/g) || []).length;\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return \"block\";\n\nvar pay = answers.payOffPlatform;\nvar move = answers.moveOffPlatform;\nif (!pay || !move) throw new Error(\"missing decision answers\");\nif (pay.type !== \"noul\") throw new Error(\"unexpected answer type for payOffPlatform: \" + pay.type);\nif (move.type !== \"noul\") throw new Error(\"unexpected answer type for moveOffPlatform: \" + move.type);\n\n// Intent judged by the model: steering payment or conversation off the platform -> warn.\nvar THRESHOLD = 0.5;\nif (pay.noul >= THRESHOLD || move.noul >= THRESHOLD) return \"warn\";\nreturn \"deliver\";",
  "notes": "Two noul questions carry the whole intent judgment that the hardcoded term list used to approximate: payOffPlatform detects attempts to reroute payment off the platform (with explicit carve-outs so contextual mentions like 'I paid through the app, not PayPal' stay clean), and moveOffPlatform detects invitations to continue talking elsewhere such as email or chat apps (so 'let's take this to my email' now warns instead of sailing through). All mechanical checks stay in code: decide_js re-runs the exact URL and phone regexes on the raw body and preserves the unconditional block for accounts younger than one day that contain either. Either noul probability reaching 0.5 produces a warn; below that the message is delivered. Missing keys or non-noul answer types are thrown as errors rather than defaulted, per the API contract."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "messageId": "M-1",
      "senderAccountAgeDays": 120,
      "messageBody": "I paid through the app, not PayPal, so the receipt should be in your orders tab."
    },
    "answers": {
      "payOffPlatform": {
        "type": "noul",
        "noul": 0.02
      },
      "moveOffPlatform": {
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
      "messageId": "M-2",
      "senderAccountAgeDays": 30,
      "messageBody": "Let's take this to my email, I will send you the address and we can sort the payment there and skip the fees."
    },
    "answers": {
      "payOffPlatform": {
        "type": "noul",
        "noul": 0.97
      },
      "moveOffPlatform": {
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
      "messageId": "M-3",
      "senderAccountAgeDays": 0,
      "messageBody": "Call me on 415 555 0100 to arrange pickup."
    },
    "answers": {
      "payOffPlatform": {
        "type": "noul",
        "noul": 0.11
      },
      "moveOffPlatform": {
        "type": "noul",
        "noul": 0.96
      }
    },
    "action": "block",
    "error": null
  }
]
```
