export const DECISION_MODEL = "typesafe/jev-1.13-20260917";
export const MIN_CONFIDENCE = 0.7;
export const MAX_PROBABILITY = 0.75;

export type IncidentReport = {
  text: string;
  affectedService: string;
};

export type UrgencyRating = {
  urgency: 1 | 2 | 3 | 4 | 5;
  confidence?: number;
  probabilities?: Record<number, number>;
  needsReview: boolean;
  decisionModel: string;
};

type DecisionsScoreResponse = {
  model: string;
  answers: Record<string, unknown>;
};

const URGENCY_RUBRIC = [
  "Routine incident with no user impact; can wait until normal business hours.",
  "Minor degraded functionality with a simple workaround and no growing impact.",
  "Noticeable degradation for some users or a service at risk of worsening.",
  "Major outage or severe degradation affecting many users, with no workaround.",
  "Complete outage or data/security impact affecting all users or revenue-critical activity.",
];

const URGENCY_QUESTION = {
  type: "score" as const,
  instructions:
    "Rate the current operational urgency of this incident report from 1 to 5. Judge actual or imminent impact on users and the affected service. Do not raise the rating because the text is dramatic, personal, or demanding; judge the operational situation described.",
  criteria: URGENCY_RUBRIC,
};

type ScoreAnswer = {
  type: "score";
  score: number;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export function validateReport(report: IncidentReport): void {
  if (!report || typeof report !== "object") {
    throw new TypeError("report must be an object");
  }
  if (typeof report.text !== "string" || report.text.trim().length === 0) {
    throw new TypeError("report.text must be a non-empty string");
  }
  if (typeof report.affectedService !== "string" || report.affectedService.trim().length === 0) {
    throw new TypeError("report.affectedService must be a non-empty string");
  }
  if (report.text.length > 12_000) {
    throw new RangeError("report.text exceeds 12000 characters");
  }
  if (report.affectedService.length > 500) {
    throw new RangeError("report.affectedService exceeds 500 characters");
  }
}

function toLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(score);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as 1 | 2 | 3 | 4 | 5;
}

function normalizeProbabilities(answer: ScoreAnswer): Record<number, number> | undefined {
  if (!answer.probabilities) return undefined;

  const levels = Object.keys(answer.probabilities)
    .map((key) => Number.parseInt(key, 10))
    .filter((level) => Number.isInteger(level) && level >= 0 && level <= 4);
  if (levels.length === 0) return undefined;

  const normalized: Record<number, number> = {};
  let total = 0;
  for (const level of levels) {
    const probability = answer.probabilities[String(level)]!;
    if (probability >= 0) {
      normalized[level + 1] = probability;
      total += probability;
    }
  }
  if (total <= 0) return undefined;
  for (const level of levels) {
    normalized[level + 1] = normalized[level + 1]! / total;
  }
  return normalized;
}

function hasClearAnswer(
  probabilities: Record<number, number> | undefined,
  confidence: number | undefined,
): boolean {
  const strongestProbability = probabilities
    ? Math.max(...Object.values(probabilities))
    : 0;
  return strongestProbability >= MAX_PROBABILITY || (confidence ?? 0) >= MIN_CONFIDENCE;
}

export async function rateIncidentUrgency(
  report: IncidentReport,
  options: { apiKey?: string } = {},
): Promise<UrgencyRating> {
  validateReport(report);

  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const httpResponse = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DECISION_MODEL,
      state: {
        report_text: report.text.trim(),
        affected_service: report.affectedService.trim(),
      },
      questions: {
        urgency: URGENCY_QUESTION,
      },
    }),
  });

  if (!httpResponse.ok) {
    const errorBody = await httpResponse.text();
    throw new Error(`Decisions API request failed (${httpResponse.status}): ${errorBody}`);
  }

  const response = (await httpResponse.json()) as DecisionsScoreResponse;
  const answer = response.answers.urgency as ScoreAnswer | undefined;
  if (!answer || answer.type !== "score") {
    throw new Error(`Expected a score answer, received ${answer?.type ?? "no answer"}`);
  }

  const probabilities = normalizeProbabilities(answer as ScoreAnswer);
  const confidence = (answer as ScoreAnswer).confidence;
  const urgency = toLevel((answer as ScoreAnswer).score);
  const needsReview = !hasClearAnswer(probabilities, confidence);

  return {
    urgency,
    confidence,
    probabilities,
    needsReview,
    decisionModel: response.model,
  };
}

export async function sortIncidentReportsByUrgency(
  reports: IncidentReport[],
  options: { apiKey?: string; onReview?: (report: IncidentReport, rating: UrgencyRating) => void } = {},
): Promise<{ report: IncidentReport; rating: UrgencyRating }[]> {
  if (!Array.isArray(reports)) throw new TypeError("reports must be an array");

  const rated = await Promise.all(
    reports.map(async (report) => {
      const rating = await rateIncidentUrgency(report, options);
      if (rating.needsReview) options.onReview?.(report, rating);
      return { report, rating };
    }),
  );

  return rated.sort((left, right) => {
    const urgencyDifference = left.rating.urgency - right.rating.urgency;
    if (urgencyDifference !== 0) return urgencyDifference;
    return (right.rating.confidence ?? 0) - (left.rating.confidence ?? 0);
  });
}
