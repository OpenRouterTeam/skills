import { decide, parseRequest } from "./lib/decisions.ts";
import { breakingQuestion } from "./question.ts";

export const DECISION_MODEL = "typesafe/jev-1.13-20260917";
// Initial probe: non-breaking 0.03–0.04, ambiguous 0.37, breaking 0.98.
// False negatives can admit breaking changes; false positives delay compatible PRs.
// Keep a review band around the baseline 0.5 gate. Reprobe before changing model.
export const REVIEW_MIN = 0.25;
export const BREAKING_MIN = 0.75;
export const MAX_DESCRIPTION_CHARS = 12_000;

export type GateResult = {
  outcome: "pass" | "block" | "review";
  reason: string;
  model?: string;
  probability?: number;
};

export function routeProbability(probability: number): GateResult["outcome"] {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error("Invalid breaking-change probability");
  }
  if (probability >= BREAKING_MIN) return "block";
  if (probability >= REVIEW_MIN) return "review";
  return "pass";
}

export async function gateDescription(description: unknown): Promise<GateResult> {
  if (typeof description !== "string" || !description.trim()) {
    return { outcome: "review", reason: "Missing PR description" };
  }
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return { outcome: "review", reason: "Description exceeds supported size" };
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { outcome: "review", reason: "Missing OPENROUTER_API_KEY" };

  try {
    const request = parseRequest({
      model: DECISION_MODEL,
      state: { pr: { description } },
      questions: { is_breaking: breakingQuestion },
    }, "PR breaking-change gate");
    const { response } = await decide(request, "http", apiKey);
    const answer = response.answers.is_breaking;
    console.error(JSON.stringify({ model: response.model, is_breaking: answer }));
    if (response.model !== DECISION_MODEL || answer.type !== "noul") {
      throw new Error("Unexpected model or answer type");
    }
    const outcome = routeProbability(answer.noul);
    return {
      outcome,
      reason: outcome === "block" ? "Breaking change" :
        outcome === "review" ? "Uncertain compatibility" : "Description gate passed",
      model: response.model,
      probability: answer.noul,
    };
  } catch {
    // Provider errors may contain submitted text. Do not echo them into CI logs.
    return { outcome: "review", reason: "Decision request failed or returned an invalid answer" };
  }
}
