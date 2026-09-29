/**
 * Human-handoff gate for a support bot.
 *
 * This deliberately uses OpenRouter's Decisions API instead of asking a chat
 * model to emit text that application code has to parse.
 */

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// Keep this pinned to the build used during calibration. Re-probe before
// changing either this model or the threshold.
export const DECISION_MODEL = "typesafe/jev-1.13-20260917";

// Escalate only when the model is strongly convinced a human is required.
// The old implementation escalated on the generated token "yes"; this gate
// leaves uncertain cases with the bot, which is the desired direction here.
export const ESCALATION_THRESHOLD = 0.85;

export type HandoffDecision = {
  escalate: boolean;
  probabilityHumanRequired: number;
  model: string;
  error?: string;
};

type DecisionsResponse = {
  model?: unknown;
  answers?: {
    requires_human?: {
      type?: unknown;
      noul?: unknown;
    };
  };
};

/**
 * Return whether the conversation needs a human. API and response failures
 * are escalated conservatively because silently keeping a case with the bot
 * is the riskier failure mode.
 */
export async function shouldEscalate(
  conversation: string,
  apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.OPENROUTER_API_KEY,
): Promise<HandoffDecision> {
  try {
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

    const response = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DECISION_MODEL,
      state: { conversation },
      questions: {
        requires_human: {
          type: "noul",
          instructions:
            "Does this support conversation require a human agent instead of a normal bot answer?",
          criteria: {
            true:
              "The bot cannot safely and completely answer from the conversation, or the issue requires human judgment, account action, sensitive handling, or a policy exception.",
            false:
              "The bot can answer the customer's question accurately and safely using the conversation, without human-only action or judgment.",
          },
        },
      },
    }),
  });

    if (!response.ok) {
      throw new Error(`Decisions API returned ${response.status}`);
    }

    const body = (await response.json()) as DecisionsResponse;
    const answer = body.answers?.requires_human;
    if (
      answer?.type !== "noul" ||
      typeof answer.noul !== "number" ||
      !Number.isFinite(answer.noul) ||
      answer.noul < 0 ||
      answer.noul > 1 ||
      typeof body.model !== "string"
    ) {
      throw new Error("Decisions API returned an invalid requires_human answer");
    }

    return {
      escalate: answer.noul >= ESCALATION_THRESHOLD,
      probabilityHumanRequired: answer.noul,
      model: body.model,
    };
  } catch (error) {
    // Fail closed: a transport or schema failure must not strand a customer.
    return {
      escalate: true,
      probabilityHumanRequired: 1,
      model: DECISION_MODEL,
      error: error instanceof Error ? error.message : "Unknown decision error",
    };
  }
}
