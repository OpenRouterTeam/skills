# support-ops-moderation_reviews-z-ai_glm-5.3-flash-r3

Site: `src/moderation/reviews.ts`

Brief given to both authors:

> Replace the word lists and promo regexes in moderate() with a decision model, keeping the same flags and publish decision.

## Candidate A

### Design

```json
{
  "questions": {
    "profanity": {
      "type": "noul",
      "instructions": "Is the language of this review (its `title` and `body`) profane or vulgar?",
      "criteria": {
        "true": "The review uses swear words or vulgar language, including mild profanity such as 'damn', 'hell', 'crap', 'wtf', or 'bs'.",
        "false": "The review's language is clean; harsh criticism expressed in ordinary words is not profanity."
      }
    },
    "promotional": {
      "type": "noul",
      "instructions": "Is this review promotional rather than a genuine account of the reviewer's experience with the product?",
      "criteria": {
        "true": "The review advertises or steers readers elsewhere: it contains a link or URL, shares a discount or promo code, tells readers to check out the reviewer's own content, product, or business, or asks readers to contact, message, or follow the reviewer (for example 'DM me').",
        "false": "The review only describes the reviewer's experience with the product; mentioning a price, a sale, or that it was bought at a discount is not promotional by itself."
      }
    },
    "harassment": {
      "type": "noul",
      "instructions": "Is this review insulting or demeaning toward a person?",
      "criteria": {
        "true": "The review directs insults or demeaning words at a person or people, such as the seller, support staff, or another reviewer, for example calling someone an idiot, stupid, a moron, or a loser.",
        "false": "The review criticizes the product, the company, or the experience without insulting anyone."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const body = String(input.body == null ? '' : input.body);\n// Code-side fact that settles the action: a body under 12 chars sets too_short, which forces\n// hold no matter what the text judgments say, so skip the model entirely for these inputs.\nif (body.trim().length < 12) return null;\n// Send only what the questions read: the review text. rating, verifiedPurchase, and ids stay out.\nreturn { title: String(input.title == null ? '' : input.title), body: body };",
  "decide_js": "// Gates are named constants; 0.5 is the pre-probe default until probing on the pinned model sets real numbers.\nconst TOO_SHORT_CHARS = 12;   // unchanged code-side rule: body under this many chars flags too_short\nconst PROFANITY_GATE = 0.5;   // miss: profanity publishes; false alarm: a clean review is held\nconst PROMOTIONAL_GATE = 0.5; // miss: an ad publishes; false alarm: a genuine review is held\nconst HARASSMENT_GATE = 0.5;  // miss: an insult publishes; false alarm: a harsh-but-fair review is held\nconst flags = [];\nif (String(input.body == null ? '' : input.body).trim().length < TOO_SHORT_CHARS) flags.push('too_short');\nif (state == null) {\n  // build_state_js skips the model only when the length rule already settled the action: hold.\n  return 'hold';\n}\nconst profanity = answers.profanity;\nconst promotional = answers.promotional;\nconst harassment = answers.harassment;\nif (!profanity || profanity.type !== 'noul' || typeof profanity.noul !== 'number') throw new Error('missing or malformed answer: profanity');\nif (!promotional || promotional.type !== 'noul' || typeof promotional.noul !== 'number') throw new Error('missing or malformed answer: promotional');\nif (!harassment || harassment.type !== 'noul' || typeof harassment.noul !== 'number') throw new Error('missing or malformed answer: harassment');\nif (profanity.noul >= PROFANITY_GATE) flags.push('profanity');\nif (promotional.noul >= PROMOTIONAL_GATE) flags.push('promotional');\nif (harassment.noul >= HARASSMENT_GATE) flags.push('harassment');\nreturn flags.length === 0 ? 'publish' : 'hold';",
  "notes": "The model makes the three text judgments the word lists and regexes approximated: profanity, promotional intent, and harassment, each as its own noul because the flags can co-occur and each needs an absolute yes-probability; the questions are phrased as properties of the review rather than presence checks, so negations like 'no promo codes needed' read false. Code keeps everything deterministic: state is only title and body (rating, verifiedPurchase, and ids are read by no question), the too_short flag is the unchanged body-length rule, and publish holds only when no flag is set. When that length rule already forces a hold (body under 12 chars), build_state_js returns null and the model is skipped, since the action is settled without it. Each noul is gated at a named constant, all 0.5 as the pre-probe default; probing on the pinned model should set the real numbers, and the gates likely diverge because the mistake costs differ (a missed ad or insult publishes, a false alarm holds a clean review). A missing or mistyped answer throws rather than defaulting. The judgments generalize the literal lists to unlisted words, masked forms, and phrasings the regexes missed (e.g. 'use code: SAVE20'), and harassment is judged as insults directed at people, so product-directed rudeness no longer sets that flag; thresholds do not carry between models, so re-probe on any model change."
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
      "profanity": {
        "type": "noul",
        "noul": 0.02
      },
      "promotional": {
        "type": "noul",
        "noul": 0.02
      },
      "harassment": {
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
      "profanity": {
        "type": "noul",
        "noul": 0.01
      },
      "promotional": {
        "type": "noul",
        "noul": 0.97
      },
      "harassment": {
        "type": "noul",
        "noul": 0.03
      }
    },
    "action": "hold",
    "error": null
  }
]
```
