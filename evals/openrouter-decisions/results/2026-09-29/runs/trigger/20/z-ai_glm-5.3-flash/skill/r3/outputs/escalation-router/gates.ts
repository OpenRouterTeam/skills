export const ESCALATE_THRESHOLD = 0.8;
export const HANDOFF_THRESHOLD = 0.2;

export type RoutingAction = "answer" | "review" | "human";

export function gate(probability: number): RoutingAction {
  if (probability >= ESCALATE_THRESHOLD) return "answer";
  if (probability > HANDOFF_THRESHOLD) return "review";
  return "human";
}
