const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const DECISION_MODEL = "typesafe/jev-1.13-20260917";

// Tune these against a representative probe set. They are deliberately code-side
// policy: the model supplies probabilities, while the application decides what to do.
const SPAM_THRESHOLD = 0.8;
const ABUSE_THRESHOLD = 0.8;

export type ReviewLabel = "spam" | "abusive" | "fine";

export type ReviewClassification = {
  label: ReviewLabel;
  spamProbability: number;
  abusiveProbability: number;
  model: string;
};

type NoulAnswer = {
  type: "noul";
  noul: number;
};

type DecisionsResponse = {
  model: string;
  answers: {
    spam: NoulAnswer;
    abusive: NoulAnswer;
  };
};

export async function classifyReview(review: string): Promise<ReviewClassification> {
  if (review.trim() === "") {
    throw new Error("review must not be empty");
  }

  const response = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DECISION_MODEL,
      state: { review },
      questions: {
        spam: {
          type: "noul",
          instructions:
            "Is this product review primarily unsolicited or deceptive promotional content intended to manipulate ratings or traffic?",
          criteria: {
            true: "The review is spam, such as advertising, repetitive promotion, or coordinated rating manipulation.",
            false: "The review is not spam, even if it is enthusiastic, critical, or mentions another product.",
          },
        },
        abusive: {
          type: "noul",
          instructions:
            "Is this product review abusive toward a person or protected group?",
          criteria: {
            true: "The review contains harassment, threats, hateful content, or demeaning personal attacks.",
            false: "The review may be negative or strongly worded, but it does not abuse a person or protected group.",
          },
        },
      },
    }),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`Decisions API ${response.status}: ${JSON.stringify(body)}`);
  }

  const result = parseResponse(body);
  const spamProbability = result.answers.spam.noul;
  const abusiveProbability = result.answers.abusive.noul;

  // Preserve the old precedence if both judgments are positive, but make the
  // decision from calibrated probabilities rather than generated wording.
  const label: ReviewLabel =
    spamProbability >= SPAM_THRESHOLD
      ? "spam"
      : abusiveProbability >= ABUSE_THRESHOLD
        ? "abusive"
        : "fine";

  return { label, spamProbability, abusiveProbability, model: result.model };
}

function requireApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return apiKey;
}

function parseResponse(value: unknown): DecisionsResponse {
  if (!isRecord(value) || typeof value.model !== "string" || !isRecord(value.answers)) {
    throw new Error("Decisions API returned an invalid response");
  }

  const spam = parseNoul(value.answers.spam, "spam");
  const abusive = parseNoul(value.answers.abusive, "abusive");
  return { model: value.model, answers: { spam, abusive } };
}

function parseNoul(value: unknown, key: string): NoulAnswer {
  if (!isRecord(value) || value.type !== "noul" || typeof value.noul !== "number" || !Number.isFinite(value.noul)) {
    throw new Error(`Decisions API returned an invalid ${key} answer`);
  }
  return { type: "noul", noul: value.noul };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
