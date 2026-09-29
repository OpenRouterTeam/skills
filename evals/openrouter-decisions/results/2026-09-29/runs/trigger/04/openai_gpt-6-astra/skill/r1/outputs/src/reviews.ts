import { decide, parseRequest, type Answer } from "./decisions.ts";
import { reviewQuestion } from "./review-question.ts";

export const DECISION_MODEL = "typesafe/jev-1.13-20260917";
export type Label = "spam" | "abusive" | "fine";
export type Category = Label | "none";
export type Probabilities = Record<Category, number>;

// Initial probe: ambiguous promotion scored 0.96; quoted abuse correctly scored
// fine at 0.98. Lower gates risk false flags/unsafe acceptance; higher gates
// increase manual review. Validate these cutoffs on labeled production reviews.
export const THRESHOLDS: Readonly<Record<Label, number>> = {
  spam: 0.98,
  abusive: 0.98,
  fine: 0.98,
};

export function routeAnswer(answer: Answer) {
  if (answer.type !== "choice" || !answer.probabilities) {
    throw new Error("Expected a choice answer with probabilities");
  }
  const categories: Category[] = ["spam", "abusive", "fine", "none"];
  if (!categories.includes(answer.choice as Category)) {
    throw new Error("Unknown review category");
  }
  for (const key of categories) {
    const p = answer.probabilities[key];
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error(`Invalid probability for ${key}`);
    }
  }
  const probabilities = Object.fromEntries(
    categories.map(key => [key, answer.probabilities![key]])
  ) as Probabilities;
  const category = answer.choice as Category;
  const label: Label | "review" = category !== "none" &&
    probabilities[category] >= THRESHOLDS[category] ? category : "review";
  return { label, probabilities };
}

export async function classifyReview(review: string) {
  // No model judgment is needed for an empty input.
  if (!review.trim()) {
    return { label: "review" as const, probabilities: null, model: null };
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required on the server");
  const request = parseRequest({
    model: DECISION_MODEL,
    state: { review },
    questions: { category: reviewQuestion },
  }, "review classifier");
  // HTTP, missing-answer, and malformed-response errors propagate to the caller;
  // they must not approve a review.
  const { response } = await decide(request, "http", apiKey);
  if (response.model !== DECISION_MODEL) {
    throw new Error(`Uncalibrated review model: ${response.model}`);
  }
  const result = { ...routeAnswer(response.answers.category), model: response.model };
  console.info("review_decision", result);
  return result;
}
