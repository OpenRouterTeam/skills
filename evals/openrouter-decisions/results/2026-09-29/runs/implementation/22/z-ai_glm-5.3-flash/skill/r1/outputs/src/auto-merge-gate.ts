export const BREAKING_GATE = 0.5;
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

export const breakingChangeRequest = {
  model: process.env.DECISION_MODEL ?? "typesafe/jev-1.13",
  state: {
    title: "Update public UserSettings type",
    body: "This changes the public UserSettings interface and removes the theme field. Existing applications may need to migrate to the new shape.",
  },
  questions: {
    is_breaking_change: {
      type: "noul",
      instructions:
        "Judging this pull request as a whole, is the change breaking?",
      criteria: {
        true:
          "The change can require consumers, integrations, operators, or documented workflows to update their behavior, configuration, API usage, data schema, or code.",
        false:
          "The change is backward compatible or does not change an interface, contract, runtime behavior, migration path, or documented workflow.",
      },
    },
  },
};

type BreakingResponse = {
  model: string;
  answers: Record<string, { type: string; noul?: number }>;
};

export async function gateAutoMerge(request: typeof breakingChangeRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const response = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Decisions API failed: ${response.status} ${await response.text()}`);
  }
  const parsed = (await response.json()) as BreakingResponse;
  const answer = parsed.answers.is_breaking_change;
  if (answer?.type !== "noul" || typeof answer.noul !== "number") {
    throw new Error("expected a noul answer");
  }

  const isBreaking = answer.noul >= BREAKING_GATE;
  console.log(
    JSON.stringify({
      action: isBreaking ? "block_auto_merge" : "allow_auto_merge",
      probability: answer.noul,
      threshold: BREAKING_GATE,
      model: parsed.model,
    })
  );
  return { isBreaking, probability: answer.noul, model: parsed.model };
}

if (process.argv[1]?.endsWith("auto-merge-gate.ts")) {
  await gateAutoMerge(breakingChangeRequest);
}
