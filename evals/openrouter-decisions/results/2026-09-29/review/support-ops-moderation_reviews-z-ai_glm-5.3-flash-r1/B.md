# support-ops-moderation_reviews-z-ai_glm-5.3-flash-r1

Site: `src/moderation/reviews.ts`

Brief given to both authors:

> Replace the word lists and promo regexes in moderate() with a decision model, keeping the same flags and publish decision.

## Candidate B

### Design

```json
{
  "questions": {
    "has_profanity": {
      "type": "noul",
      "instructions": "Is this review profane? Mild swear words count as profanity.",
      "criteria": {
        "true": "The review uses swear words or crude language, even mild ones (for example damn, hell, crap, wtf).",
        "false": "The review contains no swear words or crude language."
      }
    },
    "is_promotional": {
      "type": "noul",
      "instructions": "Is this review promotional — does it advertise or steer readers toward a product, seller, store, or deal instead of reviewing the product it is about?",
      "criteria": {
        "true": "The review promotes something: it includes a link, mentions a discount or promo code, points readers to another product, a store, or the reviewer's own content, or asks readers to contact the reviewer (for example 'dm me' or 'check out my').",
        "false": "The review only describes the reviewer's experience with the product. Mentioning a price, where it was bought, or a discount the reviewer received as part of genuine feedback is not promotional."
      }
    },
    "is_harassment": {
      "type": "noul",
      "instructions": "Does this review harass or insult people?",
      "criteria": {
        "true": "The review insults, demeans, or attacks a person or group, such as support staff, sellers, or other customers (for example calling someone an idiot, stupid, a moron, or a loser).",
        "false": "The review criticizes the product, service, or experience, even harshly, without insulting or attacking any person."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const title = input.title == null ? '' : String(input.title);\nconst body = input.body == null ? '' : String(input.body);\n// Code-side fact that settles the action: a body under 12 chars is flagged\n// too_short, which forces hold regardless of the other flags, so skip the model.\nif (body.trim().length < 12) return null;\nreturn { title: title, body: body };",
  "decide_js": "const PROFANITY_GATE = 0.5; // miss: profane review goes live; false flag: genuine review held for human review\nconst PROMOTIONAL_GATE = 0.5; // miss: ad goes live; false flag: genuine review held\nconst HARASSMENT_GATE = 0.5; // miss: abusive review goes live; false flag: harsh-but-fair review held\nconst TOO_SHORT_LEN = 12; // must match the constant in build_state_js\n\nconst flags = [];\nconst body = input.body == null ? '' : String(input.body);\nif (body.trim().length < TOO_SHORT_LEN) flags.push('too_short');\n\nif (state != null) {\n  const a = answers || {};\n  const gates = [\n    ['profanity', a.has_profanity, PROFANITY_GATE],\n    ['promotional', a.is_promotional, PROMOTIONAL_GATE],\n    ['harassment', a.is_harassment, HARASSMENT_GATE]\n  ];\n  for (let i = 0; i < gates.length; i++) {\n    const name = gates[i][0];\n    const ans = gates[i][1];\n    const gate = gates[i][2];\n    // Fail closed: a missing or malformed answer holds the review instead of publishing it.\n    if (!ans || ans.type !== 'noul' || typeof ans.noul !== 'number') {\n      flags.push(name);\n    } else if (ans.noul >= gate) {\n      flags.push(name);\n    }\n  }\n}\n\nreturn flags.length === 0 ? 'publish' : 'hold';",
  "notes": "The model makes the three judgments the word lists and regexes stood in for, one noul each over the review's title and body: is the review profane (mild swear words count, matching the old list's calibration), is it promotional (links, discount or promo codes, steering readers to another product, store, or the reviewer's own content, contact bait like 'dm me'), and does it harass or insult people (insults aimed at staff, sellers, or other customers, not harsh criticism of the product). Code computes the rest: the too_short flag is the original body.trim().length < 12 check, and because any flag forces hold, a too-short body settles the action on its own, so build_state_js returns null and no request is made for that input; every other input gets exactly one request carrying all three independent questions. Each flag is a named gate on the raw noul, all at the pre-probe default of 0.5 and to be retuned from the step 8 probe set, which should cover the old trigger words, a negated review ('no profanity here'), an empty or off-topic body, and adversarial text that denies being an ad while carrying a promo code; the action is publish iff no flags, else hold. A missing or malformed answer fails closed to hold, since a miss publishes violating content while a false flag only sends a genuine review to human review. The model judges the categories rather than matching literal strings, so list artifacts (substring hits like 'stupid' aimed at the product, or a store name without a URL scheme) now resolve by judgment; production should pin the probed canonical_slug in config and log the response model string with every stored decision."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "title": "Broke after a week",
      "body": "The strap snapped after seven days. Support was slow to respond. Would not buy again."
    },
    "answers": {
      "has_profanity": {
        "type": "noul",
        "noul": 0.02
      },
      "is_promotional": {
        "type": "noul",
        "noul": 0.01
      },
      "is_harassment": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "publish",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "title": "Great but cheaper elsewhere",
      "body": "Love it. If you want 20% off go to my page and message me for the code."
    },
    "answers": {
      "has_profanity": {
        "type": "noul",
        "noul": 0.02
      },
      "is_promotional": {
        "type": "noul",
        "noul": 0.97
      },
      "is_harassment": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "hold",
    "error": null
  }
]
```
