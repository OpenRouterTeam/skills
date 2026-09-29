# marketplace-ops-messages_offplatform-z-ai_glm-5.3-flash-r1

Site: `src/messages/offplatform.ts`

Brief given to both authors:

> Replace the term list in screenMessage() with a decision model that judges whether the message asks to pay or continue the conversation outside the platform, keeping the new-account rule and the URL and phone extraction in code.

## Candidate A

### Design

```json
{
  "questions": {
    "asks_pay_off_platform": {
      "type": "noul",
      "instructions": "Judging the sender's intent in this marketplace message: is the sender asking the recipient to make a payment somewhere other than this platform?",
      "criteria": {
        "true": "The sender requests, suggests, or steers the recipient toward paying through a method outside this platform, such as naming an external payment service as the way to pay, offering a deal for paying directly, or giving payment instructions that bypass the platform.",
        "false": "The sender is not steering payment away from this platform. Merely mentioning an external payment service, including stating that a payment was already made through one or refusing to pay through one, does not count."
      }
    },
    "moves_conversation_off_platform": {
      "type": "noul",
      "instructions": "Judging the sender's intent in this marketplace message: is the sender trying to move the conversation or future contact off this platform?",
      "criteria": {
        "true": "The sender proposes continuing the discussion or exchanging further communication through channels outside this platform, such as email, texting, calling, social media, or external messaging apps, or shares contact details for that purpose.",
        "false": "The sender intends to keep all communication on this platform. Contact information or links shared for ordinary transaction purposes on the platform, such as confirming an order, sharing photos, or referencing a shipment, do not count."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "var urls = input.body.match(/https?:\\/\\/\\S+|\\bwww\\.\\S+/gi) || [];\nvar phones = input.body.match(/\\+?\\d[\\d\\s().-]{7,}\\d/g) || [];\n\n// Hard policy in code: brand-new accounts carrying contact routes are blocked outright,\n// so the model is never consulted for this input.\nif (input.fromAccountAgeDays < 1 && (urls.length + phones.length > 0)) {\n  return null;\n}\n\nreturn {\n  message_body: input.body,\n  links_in_message: urls,\n  phone_numbers_in_message: phones\n};",
  "decide_js": "// Named thresholds; consequences noted beside each.\n// False negative (scam slips through as deliver) is the costly mistake, so these sit at the\n// neutral starting point of 0.5 and must be retuned upward/downward only after probing real\n// distributions (step 8).\nvar STEERS_PAYMENT_TRUE_AT = 0.5;   // below: not clearly asking to pay off-platform -> allow delivery\nvar MOVES_CONTACT_TRUE_AT = 0.5;    // below: not clearly taking contact off-platform -> allow delivery\n\n// Re-check the code-side hard rule defensively; normally build_state_js already skipped the model.\nvar urls = input.body.match(/https?:\\/\\/\\S+|\\bwww\\.\\S+/gi) || [];\nvar phones = input.body.match(/\\+?\\d[\\d\\s().-]{7,}\\d/g) || [];\nif (input.fromAccountAgeDays < 1 && (urls.length + phones.length > 0)) {\n  return \"block\";\n}\n\nfunction isTrue(answer, threshold) {\n  return !!(answer && answer.type === \"noul\" && typeof answer.noul === \"number\" && answer.noul >= threshold);\n}\n\nvar steersPayment = isTrue(answers.asks_pay_off_platform, STEERS_PAYMENT_TRUE_AT);\nvar movesContact = isTrue(answers.moves_conversation_off_platform, MOVES_CONTACT_TRUE_AT);\n\n// Either off-platform intent earns a warning banner; absence of both delivers.\nreturn (steersPayment || movesContact) ? \"warn\" : \"deliver\";",
  "notes": "Two judgments replaced the term list, one noul each because they are independent conditions that can co-occur ('pay me directly, and text me at this number'): whether the sender steers the recipient toward paying off-platform, and whether the sender tries to move ongoing contact off-platform. Each criterion spells out what counts and, critically, what looks similar but does not — mentioning PayPal while saying payment went through the app, or sharing a tracking link, must not fire — so the 'I paid through the app, not PayPal' case delivers and the previously missed 'take this to my email' case warns. Code retains ownership of everything deterministic: URL and phone extraction via the existing regexes, the hard new-account rule (under 1 day old plus any link or number blocks immediately, and build_state_js returns null so the model is skipped entirely for that input), and the final gate combining the two probabilities into warn/deliver. Only the message body plus the extracted links and phone numbers enter the state; account age is deliberately excluded because it feeds a code-side rule, not a model question. Both gates start at 0.5 as required before probing; the expected tuning after running the probe set (clear scam attempts, the benign-PayPal mention, negotiation chatter, adversarial text arguing for itself, empty/near-empty bodies) is recorded next to the named constants in decide_js, and swapping decision models requires re-running that probe since thresholds do not carry across builds."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "message_body": "I paid through the app, not PayPal, so the receipt should be in your orders tab.",
      "links_in_message": [],
      "phone_numbers_in_message": []
    },
    "answers": {
      "asks_pay_off_platform": {
        "type": "noul",
        "noul": 0.03
      },
      "moves_conversation_off_platform": {
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
      "message_body": "Let's take this to my email, I will send you the address and we can sort the payment there and skip the fees.",
      "links_in_message": [],
      "phone_numbers_in_message": []
    },
    "answers": {
      "asks_pay_off_platform": {
        "type": "noul",
        "noul": 0.97
      },
      "moves_conversation_off_platform": {
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
