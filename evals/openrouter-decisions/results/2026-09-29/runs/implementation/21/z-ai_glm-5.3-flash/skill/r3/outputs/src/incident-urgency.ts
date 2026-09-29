const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// Pin the dated build, not the `typesafe/jev-1.13` alias-style short ID, so
// probe-derived gates stay tied to the model that produced them.
export const DECISION_MODEL = "typesafe/jev-1.13-20260917";

const MIN_URGENCY = 1;
const MAX_URGENCY = 5;

type Urgency = 1 | 2 | 3 | 4 | 5;

export type IncidentReport = {
  text: string;
  service: string;
};

export type RatedIncident = IncidentReport & {
  urgency: Urgency;
  probabilities?: Record<string, number>;
  confidence?: number;
  model: string;
};

export type DecisionAnswer = {
  type?: unknown;
  score?: unknown;
  probabilities?: unknown;
  confidence?: unknown;
};

export type DecisionsResponse = {
  model?: unknown;
  answers?: Record<string, DecisionAnswer | undefined>;
};

export class IncidentUrgencyError extends Error {}

export const URGENCY_QUESTION = {
  type: "score",
  instructions:
    "How urgent is this incident for the on-call team, considering the affected service and the operational impact described in the report?",
  criteria: [
    {
      summary: "No operational impact",
      detail:
        "The report describes no service disruption or impairment. Typical examples are a question, documentation feedback, feature request, or a false report.",
    },
    {
      summary: "Minor impact with an available workaround",
      detail:
        "One user or a small group sees degraded behavior or a non-core function is affected, and work can continue or an obvious workaround exists.",
    },
    {
      summary: "Material impact but not customer-facing disruption",
      detail:
        "An internal function, batch job, reporting path, or non-critical dependency is failing or materially degraded with no workaround.",
    },
    {
      summary: "Major disruption to a critical service",
      detail:
        "A customer-facing or business-critical service is degraded for many users, or a subset of users cannot use an important function. Data may be at risk.",
    },
    {
      summary: "Critical outage or immediate harm",
      detail:
        "A critical service is down for many or all users, revenue is blocked, safety or security is actively at risk, or data is actively corrupted or exposed.",
    },
  ],
} as const;

function isIncidentReport(value: unknown): value is IncidentReport {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IncidentReport).text === "string" &&
    typeof (value as IncidentReport).service === "string" &&
    (value as IncidentReport).text.trim().length > 0
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function extractScore(answer: DecisionAnswer): number | undefined {
  if (answer.type !== "score" || !isFiniteNumber(answer.score)) return undefined;
  if (!isFiniteNumber(answer.confidence)) delete answer.confidence;
  if (
    answer.probabilities === undefined ||
    typeof answer.probabilities !== "object" ||
    answer.probabilities === null
  ) {
    delete answer.probabilities;
    return answer.score;
  }
  const probabilities: Record<string, number> = {};
  for (const [level, probability] of Object.entries(answer.probabilities)) {
    if (!isFiniteNumber(probability)) continue;
    probabilities[level] = probability;
  }
  if (Object.keys(probabilities).length === 0) {
    delete answer.probabilities;
  } else {
    answer.probabilities = probabilities;
  }
  return answer.score;
}

function roundToLevel(score: number): Urgency {
  // `score` is an expectation over five ordered levels, not a calibrated
  // quantity. It is safe to round to the nearest declared level; it is not
  // safe to treat its fractional part as severity by itself.
  return Math.min(MAX_URGENCY, Math.max(MIN_URGENCY, Math.round(score))) as Urgency;
}

export function normalizeReport(report: IncidentReport): IncidentReport {
  return { text: report.text.trim(), service: report.service.trim() };
}

export function buildRequest(report: IncidentReport) {
  const normalized = normalizeReport(report);
  if (normalized.text.length === 0) throw new IncidentUrgencyError("incident text is required");
  if (normalized.service.length === 0) throw new IncidentUrgencyError("affected service is required");
  return {
    model: DECISION_MODEL,
    state: {
      affected_service: normalized.service,
      report_text: normalized.text,
    },
    questions: {
      incident_urgency: URGENCY_QUESTION,
    },
  };
}

export type UrgencyRating = Omit<RatedIncident, "text" | "service">;

export function parseResponse(body: unknown, fallbackModel = DECISION_MODEL): UrgencyRating {
  if (typeof body !== "object" || body === null) {
    throw new IncidentUrgencyError("decisions response is not an object");
  }
  const { model, answers } = body as DecisionsResponse;
  const answer = answers?.incident_urgency;
  if (!answer) throw new IncidentUrgencyError("decisions response has no incident_urgency answer");
  const score = extractScore(answer);
  if (score === undefined) {
    throw new IncidentUrgencyError("incident_urgency is not a valid score answer");
  }
  const probabilities =
    answer.probabilities && typeof answer.probabilities === "object"
      ? (answer.probabilities as Record<string, number>)
      : undefined;
  const confidence = isFiniteNumber(answer.confidence) ? answer.confidence : undefined;
  return {
    urgency: roundToLevel(score),
    ...(probabilities ? { probabilities } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    model: typeof model === "string" && model.length > 0 ? model : fallbackModel,
  };
}

// Code-side hard policy. The decision model judges operational impact; this
// deterministic rule guarantees a declared outage is not rated below critical.
export function applyHardRules(rating: RatedIncident, report: IncidentReport): RatedIncident {
  const normalized = normalizeReport(report);
  const isDeclaredOutage = /\b(outage|down|unavailable)\b/i.test(normalized.text);
  return { ...rating, urgency: isDeclaredOutage ? 5 : rating.urgency };
}

export async function rateIncident(
  report: IncidentReport,
  options: { apiKey?: string; fetch?: typeof globalThis.fetch } = {}
): Promise<RatedIncident> {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new IncidentUrgencyError("OPENROUTER_API_KEY is required");
  const request = buildRequest(report);
  const response = await (options.fetch ?? fetch)(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new IncidentUrgencyError(`OpenRouter decisions request failed with status ${response.status}`);
  }
  const rating = parseResponse(await response.json(), request.model);
  const normalized = normalizeReport(report);
  return applyHardRules({ ...rating, text: normalized.text, service: normalized.service }, report);
}

export function sortForOnCallDashboard(incidents: RatedIncident[]): RatedIncident[] {
  return [...incidents].sort((left, right) => {
    if (left.urgency !== right.urgency) return right.urgency - left.urgency;
    const leftConfidence = left.confidence ?? 0;
    const rightConfidence = right.confidence ?? 0;
    return rightConfidence - leftConfidence;
  });
}
