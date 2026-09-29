# codex-21-z-ai_glm-5.3-flash-r3

Request given to the agent:

> Write code that rates incoming incident reports for urgency on a 1 to 5 scale so the on-call dashboard can sort them. Reports are free text plus the affected service name. Use a decision model.

## Candidate B

### README.md

```md
# Incident urgency rating

`src/incident-urgency.ts` rates free-text incident reports from `1` (no operational impact) to `5` (critical outage or immediate harm) so the on-call dashboard can sort them.

The judgment is sent to OpenRouter's Decisions API as a single `score` question over five ordered levels. Code validates the response and rounds the returned probability-weighted position to the nearest declared level. A declared outage is a code-side hard rule and always gets level `5`. A malformed answer throws rather than inventing a middle rating; if the caller wants a queue-wide guarantee, it can catch the error and use the exported `FALLBACK_URGENCY`.

Set `OPENROUTER_API_KEY` in the server environment. The pinned canonical model is `typesafe/jev-1.13-20260917`; probe it when changing the rubric or model, because probability gates do not transfer between models.

```ts
import { rateIncident, sortForOnCallDashboard } from "./src/incident-urgency.js";

const incidents = await Promise.all([
  rateIncident({ text: "Checkout is down", service: "checkout-api" }),
  rateIncident({ text: "CSV export misses one column", service: "reporting" }),
]);

const ordered = sortForOnCallDashboard(incidents);
```

```

### package-lock.json

```json
{
  "name": "incident-urgency",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "incident-urgency",
      "version": "0.1.0",
      "devDependencies": {
        "@types/node": "^24.7.2",
        "typescript": "^5.9.3"
      }
    },
    "node_modules/@types/node": {
      "version": "24.19.0",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-24.19.0.tgz",
      "integrity": "sha512-zY+5tKxXdhGh1PYI0ac+7juvEu4OI6vWtVVoj5i2m42jxAY1U+zHGt6QCyOFwykdP62sM3MJ9stoYYUw5aCWew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": ">=7.24.0 <7.24.7"
      }
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "resolved": "https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz",
      "integrity": "sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/undici-types": {
      "version": "7.24.6",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-7.24.6.tgz",
      "integrity": "sha512-WRNW+sJgj5OBN4/0JpHFqtqzhpbnV0GuB+OozA9gCL7a993SmU+1JBZCzLNxYsbMfIeDL+lTsphD5jN5N+n0zg==",
      "dev": true,
      "license": "MIT"
    }
  }
}

```

### package.json

```json
{
  "name": "incident-urgency",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "tsc --noEmit && node --test"
  },
  "devDependencies": {
    "@types/node": "^24.7.2",
    "typescript": "^5.9.3"
  }
}

```

### src/incident-urgency.test.ts

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHardRules,
  buildRequest,
  parseResponse,
  sortForOnCallDashboard,
  type RatedIncident,
} from "./incident-urgency.ts";

test("builds one score question from filtered report state", () => {
  const request = buildRequest({ text: " Checkout returns a blank page. ", service: " checkout-api " });
  assert.equal(request.state.affected_service, "checkout-api");
  assert.equal(request.state.report_text, "Checkout returns a blank page.");
  assert.equal(Object.keys(request.questions).length, 1);
  assert.equal(request.questions.incident_urgency.criteria.length, 5);
});

test("rounds a valid score answer to an integer urgency level", () => {
  const rating = parseResponse({
    model: "test-model",
    answers: {
      incident_urgency: {
        type: "score",
        score: 3.6,
        probabilities: { 0: 0, 1: 0, 2: 0.1, 3: 0.2, 4: 0.7 },
        confidence: 0.66,
      },
    },
  });
  assert.equal(rating.urgency, 4);
  assert.equal(rating.confidence, 0.66);
  assert.equal(rating.probabilities?.[4], 0.7);
});

test("rejects a malformed answer instead of defaulting to middle urgency", () => {
  assert.throws(() => parseResponse({ answers: { incident_urgency: { type: "noul", noul: 0.8 } } }));
});

test("hard rule guarantees declared outages rank critical", () => {
  const report = { text: "The status page says there is an outage.", service: "payments" };
  const rating = applyHardRules(
    { text: report.text, service: report.service, urgency: 2, model: "test-model" },
    report
  );
  assert.equal(rating.urgency, 5);
});

test("dashboard sorts by urgency and uses model confidence as a tie-break", () => {
  const incidents: RatedIncident[] = [
    { text: "a", service: "a", urgency: 2, confidence: 0.7, model: "m" },
    { text: "b", service: "b", urgency: 5, confidence: 0.5, model: "m" },
    { text: "c", service: "c", urgency: 2, confidence: 0.9, model: "m" },
  ];
  assert.deepEqual(sortForOnCallDashboard(incidents).map((incident) => incident.text), ["b", "c", "a"]);
});

```

### src/incident-urgency.ts

```ts
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

```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}

```

### Final message


Implemented and tested. Typecheck and all 5 unit tests pass.

- `src/incident-urgency.ts:1` — sends a single `score` question to OpenRouter's Decisions API, with a five-level urgency rubric and the affected service as state. Pins the canonical model (`typesafe/jev-1.13-20260917`).
- `src/incident-urgency.ts:113` — rounds the model's probability-weighted score to the nearest integer level (1–5) rather than trusting it as a raw magnitude.
- `src/incident-urgency.ts:169` — applies a code-side hard rule: text declaring an "outage", "down", or "unavailable" always rates 5 regardless of model output.
- `src/incident-urgency.ts:186` — `rateIncident` handles the API call, validates the response shape, and throws on malformed answers instead of defaulting.
- `src/incident-urgency.ts:199` — `sortForOnCallDashboard` sorts by descending urgency with model confidence as a tie-break.
- `src/incident-urgency.test.ts:1` — five tests covering request shape, score rounding, malformed-answer rejection, the outage hard rule, and dashboard ordering.

Requires `OPENROUTER_API_KEY` in the server environment.
