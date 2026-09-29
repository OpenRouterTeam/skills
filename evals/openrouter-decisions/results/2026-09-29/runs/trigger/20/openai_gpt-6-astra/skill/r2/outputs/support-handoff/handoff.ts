import { readFileSync } from "node:fs";
import { decide, parseRequest } from "./vendor/lib.ts";

export const DECISION_MODEL = "typesafe/jev-1.13-20260917";
// Provisional: comparison + pinned probes put bot cases at <= .28 and human cases at >= .51.
// A false positive wastes human time; a false negative delays needed assistance.
// Calibrate against reviewed production tickets before changing this gate.
export const ESCALATION_THRESHOLD = 0.5;
const questions = JSON.parse(readFileSync(new URL("./question.json", import.meta.url), "utf8"));

export type SupportState = {
  conversation: { role: "user" | "assistant"; content: string }[];
  relevant_help: Record<string, string>;
  bot_capabilities: string[];
  handoff_policy: string[];
};

export type HandoffDecision = {
  action: "continue" | "handoff";
  reason: "policy" | "empty" | "model" | "decision_error";
  model?: string;
  probability?: number;
  threshold?: number;
};

/** Server-side only. `continue` permits the existing bot workflow, including clarification. */
export async function decideHandoff(
  state: SupportState,
  options: {
    // Computed by trusted application code from existing mandatory policy rules,
    // agent-button selections, or exhausted workflow states; never a customer field.
    mandatoryHandoff?: boolean;
    apiKey?: string;
    log?: (decision: HandoffDecision) => void;
  } = {},
): Promise<HandoffDecision> {
  const log = options.log ?? ((decision) => console.info("support_handoff", decision));
  let decision: HandoffDecision;
  if (options.mandatoryHandoff) {
    decision = { action: "handoff", reason: "policy" };
  } else if (!state.conversation.some((message) => message.role === "user" && message.content.trim())) {
    decision = { action: "continue", reason: "empty" };
  } else {
    let observedModel: string | undefined;
    try {
      const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("Missing server-side API key");
      // Explicit projection keeps caller metadata and policy flags out of model state.
      const request = parseRequest({
        model: DECISION_MODEL,
        state: {
          conversation: state.conversation.map(({ role, content }) => ({ role, content })),
          relevant_help: state.relevant_help,
          bot_capabilities: state.bot_capabilities,
          handoff_policy: state.handoff_policy,
        },
        questions,
      }, "support handoff");
      const { response } = await decide(request, "http", apiKey);
      observedModel = response.model;
      if (response.model !== DECISION_MODEL) throw new Error("Unexpected model build");
      const answer = response.answers.requires_human;
      if (answer?.type !== "noul" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
        throw new Error("Invalid escalation probability");
      }
      decision = {
        action: answer.noul >= ESCALATION_THRESHOLD ? "handoff" : "continue",
        reason: "model",
        model: response.model,
        probability: answer.noul,
        threshold: ESCALATION_THRESHOLD,
      };
    } catch {
      // Keep the human fallback available when scoring fails; never treat failure as P=0.
      // Do not log provider error bodies, which may echo customer content.
      decision = { action: "handoff", reason: "decision_error", model: observedModel ?? DECISION_MODEL };
    }
  }
  log(decision);
  return decision;
}
