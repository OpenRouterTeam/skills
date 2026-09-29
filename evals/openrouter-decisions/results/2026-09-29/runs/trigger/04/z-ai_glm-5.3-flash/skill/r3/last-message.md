The skill's `choice` primitive is exactly the right fit: mutually exclusive options, returns a probability per label. Here's the replacement:

```ts
import { OpenRouter } from "@openrouter/sdk";

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  serverURL: "https://openrouter.ai", // Decisions lives outside /api/v1
});

// Pin the canonical slug, never an alias — check GET /api/v1/models?output_modalities=decisions
const DECISION_MODEL = "typesafe/jev-1.13"; // replace with your chosen model
const THRESHOLD = 0.5; // tighten after probing real reviews

export type ReviewClass = "spam" | "abusive" | "fine";

export async function classifyReview(review: string): Promise<ReviewClass> {
  const response = await client.alpha.decisions.create({
    decisionsRequest: {
      model: DECISION_MODEL,
      state: { review },
      questions: {
        category: {
          type: "choice",
          instructions: "What best describes this product review?",
          criteria: {
            spam: "The review is promotional, off-topic, bot-generated, or does not reflect a genuine user experience with the product.",
            abusive: "The review contains hostile, threatening, or offensive language directed at people, even if the complaint itself is legitimate.",
            fine: "The review is a genuine product opinion, whether positive, negative, or mixed, with no spam or abuse.",
          },
        },
      },
    },
  });

  const answer = response.decisionsResponse.answers.category;
  if (answer.type !== "choice") throw new Error(`Unexpected answer type: ${answer.type}`);

  // Code owns the gate. The model judges; you decide.
  const probability = answer.probabilities?.[answer.choice] ?? answer.confidence;
  if (probability < THRESHOLD) {
    // Neither option is confident — route to fallback (human review, retry, default, etc.)
    return "fine";
  }

  return answer.choice as ReviewClass;
}
```

**What changed and why:**

- **Numbers instead of words** — `probabilities` gives a value per label, so `answer.probabilities.spam >= 0.5` replaces `includes("spam")` and survives any wording.
- **Mutually exclusive labels → one `choice`** — per the skill, three exclusive outcomes is a `choice`, not separate `noul`s recombined in code.
- **State carries only the review** — no flags, no computed fields; the model reads `{ review }` and nothing else.
- **Threshold is a named constant in code** — the raw default is `>= 0.5` before probing; tighten it once you've run representative reviews through `decide.ts --compare` and seen the raw distributions.
- **Fallback for low confidence** — `confidence` measures how concentrated the distribution is, not whether the answer is correct, so it's only used to decide when to escalate; here the sub-threshold path is your safety valve.

**Before trusting it in production:** run the probe set (clear spam, clear abuse, borderline negative review, empty/off-topic input, adversarial text arguing for its own classification) through `npx tsx decide.ts request.json --compare` with your chosen model, and set `THRESHOLD` from the observed numbers, not the default.