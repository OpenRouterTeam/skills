# marketplace-ops-messages_offplatform-z-ai_glm-5.3-flash-r3

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate A

### Design

```json
{
  "questions": {
    "asks_payment_off_platform": {
      "type": "noul",
      "instructions": "In this marketplace message, is the sender asking the recipient to pay through a channel other than this platform?",
      "criteria": {
        "true": "The sender requests, suggests, or steers the recipient toward paying by some other means — another payment service, cash, wire, gift card, cryptocurrency, or handing over payment details directly.",
        "false": "Payments happening through this platform, or a payment method merely brought up while being declined, compared, or reported as already settled on the platform."
      }
    },
    "asks_conversation_off_platform": {
      "type": "noul",
      "instructions": "In this marketplace message, is the sender trying to move the ongoing conversation to somewhere other than this platform?",
      "criteria": {
        "true": "The sender proposes carrying the discussion onward elsewhere — email, texting, calling, a messaging app, social media, or meeting off-site — whether or not the contact details themselves appear in this message.",
        "false": "Keeping the exchange on this platform; a link or file shared purely as information about the item is not an attempt to leave the conversation."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "// Code-owned extraction and the hard new-account rule. Returning null blocks the\n// message and skips the model entirely (decide_js treats empty answers as \"block\").\nvar URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nvar PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nvar urls = input.body.match(URL_PATTERN) || [];\nvar phones = input.body.match(PHONE_PATTERN) || [];\n\n// Hard policy: a brand-new account sending contact info or links is blocked outright,\n// regardless of intent. Code settles this; the model is never consulted.\nif (input.fromAccountAgeDays < 1 && (urls.length > 0 || phones.length > 0)) {\n  return null;\n}\n\n// Everything the questions read: the message itself plus the contact artifacts code found.\n// Account age is deliberately excluded — it feeds a code-side rule, not a judgment.\nreturn {\n  body: input.body,\n  urls_in_message: urls.map(function (u) { return u.replace(/[.,;:!?)\\]]+$/, \"\"); }),\n  phone_numbers_in_message: phones.map(function (p) { return p.trim(); })\n};",
  "decide_js": "// Empty answers means build_state_js hit the new-account hard rule and skipped the model.\nif (!answers || Object.keys(answers).length === 0) {\n  return \"block\";\n}\n\n// Gate thresholds. Consequence of mistakes: letting a genuine off-platform ask through\n// enables fraud (expensive), while warning on a borderline message only shows a banner\n// (cheap). The threshold therefore sits slightly below neutral, favoring \"warn\".\nvar OFF_PLATFORM_WARN_THRESHOLD = 0.4;\n\nfunction probOf(key) {\n  var a = answers[key];\n  return a && a.type === \"noul\" && typeof a.noul === \"number\" ? a.noul : 0;\n}\n\nvar asksPaymentOffPlatform = probOf(\"asks_payment_off_platform\");\nvar asksConversationOffPlatform = probOf(\"asks_conversation_off_platform\");\n\n// Either form of off-platform intent warrants the warning banner; the two nouls are\n// independent judgments and are combined here in code, not in one question.\nif (\n  asksPaymentOffPlatform >= OFF_PLATFORM_WARN_THRESHOLD ||\n  asksConversationOffPlatform >= OFF_PLATFORM_WARN_THRESHOLD\n) {\n  return \"warn\";\n}\nreturn \"deliver\";",
  "notes": "Two judgments replace the term list, asked as separate nouls because they can co-occur in one message: whether the sender asks the recipient to pay outside the platform, and whether the sender tries to move the conversation off the platform. Each instruction phrases the question as the sender's intent, and the criteria exclude the confusable cases the old substring list mishandled — a payment method mentioned while being declined ('I paid through the app, not PayPal'), and a link shared as item information versus one offered as a channel to talk. Code keeps everything computational: URL and phone extraction via the existing patterns, the new-account hard rule (under 1 day old with any URL or phone returns block and skips the model entirely, signaled to decide_js by empty answers), and the final gate, which warns when either noul reaches 0.40. That threshold is set below neutral because a missed off-platform ask enables fraud while a spurious banner is cheap; it should be confirmed against a probe set covering the clear ask cases, the declined-payment and informational-link negatives, a no-contact-details proposal ('take this to my email'), and adversarial text arguing its own innocence, and retuned if the model changes."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "body": "I paid through the app, not PayPal, so the receipt should be in your orders tab.",
      "urls_in_message": [],
      "phone_numbers_in_message": []
    },
    "answers": {
      "asks_payment_off_platform": {
        "type": "noul",
        "noul": 0.03
      },
      "asks_conversation_off_platform": {
        "type": "noul",
        "noul": 0.05
      }
    },
    "action": "deliver",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "body": "Let's take this to my email, I will send you the address and we can sort the payment there and skip the fees.",
      "urls_in_message": [],
      "phone_numbers_in_message": []
    },
    "answers": {
      "asks_payment_off_platform": {
        "type": "noul",
        "noul": 0.96
      },
      "asks_conversation_off_platform": {
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
