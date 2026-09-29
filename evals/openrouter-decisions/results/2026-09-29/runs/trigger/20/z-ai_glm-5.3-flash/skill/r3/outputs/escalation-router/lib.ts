import {
  decide,
  parseRequestBody,
  requireApiKey,
  type DecisionsRequest,
  type NoulQuestion,
  type Transport,
} from "../.agents/skills/openrouter-decisions/scripts/lib.ts";
import { gate, type RoutingAction } from "./gates.ts";

export type RoutingResult = {
  action: RoutingAction;
  probability: number;
  rawAnswer: number;
};

export const escalationQuestion: NoulQuestion = {
  type: "noul",
  instructions: "Can the support bot answer this message from the supplied conversation and knowledge without a human action or account change?",
  criteria: {
    true: "The bot has enough verified information and authority to give the customer a complete, useful reply.",
    false: "The message needs a human action, privileged account access, a goodwill refund or credit, a security decision, legal or medical guidance, or information the supplied knowledge does not establish.",
  },
};

export function parseRoutingRequest(raw: unknown): DecisionsRequest {
  const body = parseRequestBody(raw, "routing request");
  return { model: process.env.DECISION_MODEL ?? "typesafe/jev-1.13", ...body, questions: { escalation: escalationQuestion } };
}

export async function routeEscalation(
  state: Record<string, unknown>,
  transport: Transport = "http"
): Promise<RoutingResult> {
  const apiKey = requireApiKey();
  const request: DecisionsRequest = {
    model: process.env.DECISION_MODEL ?? "typesafe/jev-1.13",
    state,
    questions: { escalation: escalationQuestion },
  };
  const { response } = await decide(request, transport, apiKey);
  const answer = response.answers.escalation;
  if (answer.type !== "noul") throw new Error("expected a noul escalation answer");
  return {
    action: gate(answer.noul),
    probability: answer.noul,
    rawAnswer: answer.noul,
  };
}
