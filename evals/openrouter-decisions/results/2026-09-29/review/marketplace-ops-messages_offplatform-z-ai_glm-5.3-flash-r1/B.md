# marketplace-ops-messages_offplatform-z-ai_glm-5.3-flash-r1

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate B

### Design

```json
{
  "questions": {
    "off_platform": {
      "type": "noul",
      "instructions": "This is a message between a buyer and a seller on a marketplace. Does the message ask or propose to pay outside the platform, or to continue the conversation or the rest of the transaction outside the platform?",
      "criteria": {
        "true": "The message proposes paying or getting paid through channels outside the platform (payment apps, wire or bank transfer, checks, gift cards, cryptocurrency, cash), or proposes continuing the conversation or finishing the transaction elsewhere (email, text, phone calls, another app or website), for example by offering or asking to use an outside payment method for this deal, by sharing or requesting outside contact details, handles, or links for that purpose, or by citing lower fees or fewer restrictions off the platform as a reason to move.",
        "false": "The message keeps the deal and the conversation on the platform. A passing mention of an outside service is not enough when the message does not propose using it, for example stating that payment was already made through the platform rather than through an outside service, or saying that an outside service will not be used."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const URL_PATTERN = /https?:\\/\\/\\S+|\\bwww\\.\\S+/gi;\nconst PHONE_PATTERN = /\\+?\\d[\\d\\s().-]{7,}\\d/g;\nconst urls = (input.body.match(URL_PATTERN) || []).length;\nconst phones = (input.body.match(PHONE_PATTERN) || []).length;\n// The new-account rule stays in code. When it fires, the model cannot change the\n// outcome (block), so skip the request; decide_js returns \"block\" for null state.\nif (input.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return null;\nreturn { body: input.body, urlCount: urls, phoneCount: phones };",
  "decide_js": "if (state === null) {\n  // build_state_js returns null only when the new-account rule fires\n  // (fromAccountAgeDays < 1 with a URL or phone number): block without a request.\n  return \"block\";\n}\nconst answer = answers.off_platform;\nif (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\") {\n  // Per the Decisions API guidance, a missing key or unexpected type is an\n  // error, not a default.\n  throw new Error(\"off_platform answer missing or not noul\");\n}\nif (answer.noul >= 0.5) return \"warn\";\n// Deterministic floor kept from the original screenMessage: any link or phone\n// number warns even when the model sees no off-platform intent.\nif (state.urlCount + state.phoneCount > 0) return \"warn\";\nreturn \"deliver\";",
  "notes": "The model replaces only the PAYMENT_TERMS keyword check: one noul question asks whether the message proposes paying or continuing the conversation off the platform, with criteria written so passing mentions (\"I paid through the app, not PayPal\") stay false and proposals (\"take this to my email\") come back true; a probability of at least 0.5 warns. Code keeps the exact URL and phone regex extraction and the new-account rule: build_state_js returns null when fromAccountAgeDays < 1 and any link or phone number is present, skipping the request since the model cannot change that outcome, and decide_js returns \"block\" for a null state. The original deterministic warn on any link or phone number from older accounts is kept as a floor in decide_js (urlCount + phoneCount > 0), so the model's verdict decides warn versus deliver exactly for messages without contact info, which is the gap the term list used to cover and now also catches keyword-free asks like email solicitation. A missing answer or a non-noul type throws rather than defaulting, per the API's error guidance."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "body": "I paid through the app, not PayPal, so the receipt should be in your orders tab.",
      "urlCount": 0,
      "phoneCount": 0
    },
    "answers": {
      "off_platform": {
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
      "urlCount": 0,
      "phoneCount": 0
    },
    "answers": {
      "off_platform": {
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
