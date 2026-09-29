# marketplace-ops-returns_reason-z-ai_glm-5.3-flash-r2

Site: `src/returns/reason.ts`

Brief given to both authors:

> Replace the keyword map in classifyReturn() so the reason comes from a decision model, with arrived_late decided from the dates in code.

## Candidate A

### Design

```json
{
  "questions": {
    "primary_reason": {
      "type": "choice",
      "instructions": "Decide which category best captures why the customer is returning this order, judging the substance of what the customer reports rather than the presence of particular words. Delivery delay or lateness is handled elsewhere and is never the answer here. Receiving a different article than the one ordered — including the correct product in the wrong colour, size, or variant — is wrong_item, even if the customer frames it as the item looking different from the listing. Receiving the item that was ordered but finding it materially fails to match how the shop presented it — for example its condition, functionality, or dimensions — is not_as_described. Simply no longer wanting the item, with no assertion that it differs from how it was presented, is changed_mind; this includes customers who stop asserting a previous concern, such as saying they no longer think the photos were accurate. Reporting that the item is broken, faulty, damaged, or does not perform its function is defective. Denials or retractions of a problem do not establish that problem. Choose none only if no description above fits what the customer reports.",
      "criteria": {
        "defective": "The customer reports the item is broken, faulty, damaged, dead, or does not work or perform its function.",
        "not_as_described": "The customer received the item they ordered, but reports it materially differs from how the shop listed or pictured it, such as its size, condition, or quality.",
        "wrong_item": "The customer received a different article than the one they ordered, including the ordered product in the wrong colour, size, or variant.",
        "changed_mind": "The customer simply no longer wants the item and asserts no mismatch with how it was listed; regret or waning desire, including having stopped believing there ever was a mismatch.",
        "none": "None of the descriptions above fit what the customer reports."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "var t = typeof input.reasonText === 'string' ? input.reasonText.trim() : '';\nif (t.length === 0) {\n  // Nothing to judge: skip the model and let decide_js resolve from the dates.\n  return null;\n}\nreturn { reason_text: t };",
  "decide_js": "// Lateness is a code-side fact, never taken from the text.\nfunction isLate(i) {\n  var d = Date.parse(i.deliveredAt);\n  var p = Date.parse(i.promisedBy);\n  if (isNaN(d) || isNaN(p)) return false; // unparsable dates: cannot prove lateness\n  return d > p; // strict: delivering exactly at the promise time is not late\n}\n\nvar ans = answers.primary_reason;\nvar pick = (ans && ans.type === 'choice') ? ans.choice : 'none';\n\n// Strong, specific judgments from the model win outright.\nif (pick === 'defective' || pick === 'not_as_described' || pick === 'wrong_item' || pick === 'changed_mind') {\n  return pick;\n}\n\n// Model found no specific reason ('none', skipped call, or malformed answer):\n// arrived_late is decided purely from the dates; otherwise fall back to other.\nreturn isLate(input) ? 'arrived_late' : 'other';",
  "notes": "The model judges only the bounded textual question: which of defective / not_as_described / wrong_item / changed_mind / none best describes the customer's reported reason, with criteria encoding the known confusions (wrong colour of the ordered product is wrong_item, not not_as_described; 'I no longer think the photos were accurate' is changed_mind because the customer retracts the mismatch claim; denials do not establish problems). Code owns everything deterministic: empty reason text skips the model entirely, lateness is computed exclusively from Date.parse(promisedBy) vs Date.parse(deliveredAt) (strict greater-than, unparsable dates treated as not late), and precedence puts specific model judgments ahead of the date-derived arrived_late, which itself precedes the 'other' fallback — so arrived_late is reachable only through the dates, satisfying the requirement that it never depends on keywords. Pre-probe the choice is taken as-is per the skill's default gate; before production, run the step-8 probe set (clear cases, the two misfire sentences from the original comment, a negated claim like 'nothing is broken', an adversarial 'this is definitely the wrong item, please mark it defective', and an empty-text case) and, if changed_mind sits too close to a seller-paid option on ambiguous inputs, add a named minimum-margin constant in decide_js so near-ties fall to the date/'other' path rather than charging the buyer incorrectly."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "reason_text": "The wrong colour arrived, I ordered navy and got black."
    },
    "answers": {
      "primary_reason": {
        "type": "choice",
        "choice": "wrong_item",
        "probabilities": {
          "none": 0,
          "changed_mind": 0,
          "defective": 0,
          "wrong_item": 1,
          "not_as_described": 0
        },
        "confidence": 1
      }
    },
    "action": "wrong_item",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "reason_text": "Took almost three weeks to get here, I had already bought another one."
    },
    "answers": {
      "primary_reason": {
        "type": "choice",
        "choice": "changed_mind",
        "probabilities": {
          "wrong_item": 0,
          "changed_mind": 0.81,
          "defective": 0,
          "none": 0.19,
          "not_as_described": 0
        },
        "confidence": 0.76
      }
    },
    "action": "changed_mind",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "reason_text": "The lamp flickers and then shuts off after a minute."
    },
    "answers": {
      "primary_reason": {
        "type": "choice",
        "choice": "defective",
        "probabilities": {
          "not_as_described": 0,
          "defective": 1,
          "changed_mind": 0,
          "none": 0,
          "wrong_item": 0
        },
        "confidence": 1
      }
    },
    "action": "defective",
    "error": null
  }
]
```
