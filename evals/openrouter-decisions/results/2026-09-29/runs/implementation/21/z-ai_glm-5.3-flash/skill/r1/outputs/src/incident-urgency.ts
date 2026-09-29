import { decide, type DecisionsRequest, type ScoreAnswer } from "../.agents/skills/openrouter-decisions/scripts/lib.ts";

export type IncidentReport = {
  report: string;
  service: string;
};

export type IncidentUrgency = {
  urgency: 1 | 2 | 3 | 4 | 5;
  probabilities?: Record<string, number>;
  confidence?: number;
  model: string;
  provider?: string;
};

/** Nearest-level fallback for a response the model rates between levels. */
export const SCORE_TO_LEVEL = 0.5;
/**
 * Probability mass must reach this level for a score answer to be used.
 * Below it, code falls back to nearest level; tune after probing.
 */
export const MIN_CONFIDENCE = 0;
/** Pinned production model. Never replace with an alias without re-probing. */
export const DECISION_MODEL = "typesafe/jev-1.13-20260917";

const CRITERIA = [
  "Level 1: Scheduled or cosmetic issue. No user, data, or revenue impact right now; normal backlog handles it.",
  "Level 2: Minor degradation or early warning. Workarounds exist and the service remains usable.",
  "Level 3: Serious degradation or limited outage. A real group of users or a critical workflow is affected.",
  "Level 4: Major outage or data-loss risk. Broad user impact or an important production workflow is down.",
  "Level 5: Company-critical emergency. Total outage, data loss in progress, security breach, or revenue is actively stopped.",
] as const;

export function buildRequest(report: IncidentReport): DecisionsRequest {
  const trimmedReport = report.report.trim();
  if (trimmedReport.length === 0 || report.service.trim().length === 0) {
    throw new TypeError("report and service must be non-empty");
  }
  return {
    model: DECISION_MODEL,
    state: {
      affected_service: report.service.trim(),
      report: trimmedReport,
    },
    questions: {
      urgency: {
        type: "score",
        instructions:
          "How urgent is this incident for the on-call team, based on the current impact described in `report` for `affected_service`?",
        criteria: [...CRITERIA],
      },
    },
  };
}

function toLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  const level = Math.min(5, Math.max(1, Math.round(score + 1)));
  return level as 1 | 2 | 3 | 4 | 5;
}

export const toLevelForTest = toLevel;

export async function rateIncident(
  report: IncidentReport,
  apiKey: string,
): Promise<IncidentUrgency> {
  const request = buildRequest(report);
  const { response } = await decide(request, "http", apiKey);
  const answer = response.answers.urgency;
  if (answer?.type !== "score") {
    throw new Error("Decisions API did not return a score answer for urgency");
  }
  const scoreAnswer = answer as ScoreAnswer;
  return {
    urgency: toLevel(scoreAnswer.score),
    probabilities: scoreAnswer.probabilities,
    confidence: scoreAnswer.confidence,
    model: response.model,
    provider: response.provider,
  };
}
