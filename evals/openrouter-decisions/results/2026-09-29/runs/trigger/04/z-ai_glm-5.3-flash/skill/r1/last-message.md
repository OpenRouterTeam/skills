Here's the replacement. Three independent conditions → three `noul`s (they can co-occur), each giving you a `P(yes)` you threshold in code:

```ts
type ReviewVerdict = "spam" | "abusive" | "fine";

const SPAM_T = 0.7;   // P(spam) at/above this → treat as spam
const ABUSIVE_T = 0.7; // P(abusive) at/above this → treat as abusive

// one config value, pinned to a versioned model, never an alias
const DECISION_MODEL = "typesafe/jev-1.13-20260917";

async function classifyReview(review: string): Promise<ReviewVerdict> {
  const client = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    serverURL: "https://openrouter.ai",
  });

  const response = await client.alpha.decisions.create({
    decisionsRequest: {
      model: DECISION_MODEL,
      state: { review },
      questions: {
        is_spam: {
          type: "noul",
          instructions: "Is this review promotional spam rather than genuine customer feedback?",
          criteria: {
            true: "The review primarily promotes a product, seller, website, discount code, or off-platform contact.",
            false: "The review gives the author's own experience with the product or service.",
          },
        },
        is_abusive: {
          type: "noul",
          instructions: "Is this review abusive toward a person or group?",
          criteria: {
            true: "The review contains insults, slurs, threats, harassment, or hateful language directed at someone.",
            false: "The review criticizes the product without attacking any person or group.",
          },
        },
      },
    },
  });

  const spam = response.answers.is_spam;
  const abusive = response.answers.is_abusive;
  if (spam.type !== "noul" || abusive.type !== "noul") {
    throw new Error("unexpected decision answer types");
  }

  if (spam.noul >= SPAM_T) return "spam";
  if (abusive.noul >= ABUSIVE_T) return "abusive";
  return "fine";
}
```

Key points:

- **Numbers, not strings.** Each condition returns `P(yes)`; `SPAM_T` / `ABUSIVE_T` are named constants you own. If you later want a low-confidence band (e.g. `0.5–0.7` → human review queue), that's one more comparison in code.
- **Independent conditions.** Spam and abuse can co-occur, so they're separate `noul`s, not one `choice`. If you only ever need a single winner, a `choice` over `["spam", "abusive", "fine"]` also works — same idea, but then you get per-label probabilities instead of absolute ones.
- **Pinned model.** `DECISION_MODEL` is a versioned ID from the live catalog (`GET /api/v1/models?output_modalities=decisions`), set once in config; swapping models later is a config change plus a threshold re-probe.
- **Probe before trusting the 0.7s.** Run the bundled `decide.ts` over real reviews — clear spam, clear abuse, a heated-but-legit complaint (looks like abuse but isn't), a promotional-but-polite review, an empty input — and set both thresholds from the observed numbers, not from these placeholders.

The skill directory also has `scripts/lib.ts` with `parseRequest`/`decide` helpers if you'd rather use raw HTTP than the SDK.