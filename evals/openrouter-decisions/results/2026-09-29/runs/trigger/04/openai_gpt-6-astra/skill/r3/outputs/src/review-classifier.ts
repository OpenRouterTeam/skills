import { decide, parseRequest, type ChoiceAnswer } from "./vendor/decisions.ts";
import { reviewQuestion } from "./review-question.ts";

// Pin a build: changing this requires re-running the probes and tuning thresholds.
export const DECISION_MODEL = "typesafe/jev-1.13-20260917";
export type ReviewLabel = "spam" | "abusive" | "fine";
export type ReviewDecision = {
  label: ReviewLabel;
  probabilities: Record<ReviewLabel, number>;
  model: string;
};

const labels: ReviewLabel[] = ["spam", "abusive", "fine"];

export function readCategory(answer: ChoiceAnswer): Omit<ReviewDecision, "model"> {
  if (!labels.includes(answer.choice as ReviewLabel)) throw new Error("Unknown review label");
  const p = answer.probabilities;
  if (!p || labels.some(label => !Number.isFinite(p[label]) || p[label] < 0 || p[label] > 1)) {
    throw new Error("Missing or invalid review probabilities");
  }
  return {
    label: answer.choice as ReviewLabel,
    probabilities: { spam: p.spam, abusive: p.abusive, fine: p.fine },
  };
}

/** Server-side only. API/validation errors propagate; they never become "fine". */
export async function classifyReview(review: string): Promise<ReviewDecision> {
  if (!review.trim()) throw new Error("Review must not be empty");
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

  const request = parseRequest({
    model: DECISION_MODEL,
    state: { review },
    questions: { category: reviewQuestion },
  }, "review classifier");
  const { response } = await decide(request, "http", apiKey);
  const answer = response.answers.category;
  if (!answer || answer.type !== "choice") throw new Error("Expected category choice");
  const result = { ...readCategory(answer), model: response.model };
  // Record the exact model and scores, without logging the review text.
  console.info("review-decision", result);
  return result;
}

/** Optional gate. Supply thresholds tuned on your labeled reviews for this build.
 * Raising a threshold sends more valid reviews to review; lowering it admits more
 * incorrect labels (including spam or abuse incorrectly labeled fine).
 */
export function gateReview(
  decision: ReviewDecision,
  minimumProbability: Record<ReviewLabel, number>,
): ReviewLabel | "review" {
  for (const label of labels) {
    const threshold = minimumProbability[label];
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new Error(`Invalid threshold for ${label}`);
    }
  }
  return decision.probabilities[decision.label] >= minimumProbability[decision.label]
    ? decision.label
    : "review";
}
