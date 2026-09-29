export type RefundRequest = {
  orderId: string;
  amountCents: number;
  orderedAt: string;
  deliveredAt: string | null;
  requestedAt: string;
  reason: string;
  previousRefunds: number;
};

export type RefundDecision = "approve" | "deny" | "manual_review";

const WINDOW_DAYS = 30;
const AUTO_APPROVE_MAX_CENTS = 5_000;
const MS_PER_DAY = 86_400_000;

export function decideRefund(request: RefundRequest): RefundDecision {
  const ageDays = (Date.parse(request.requestedAt) - Date.parse(request.orderedAt)) / MS_PER_DAY;
  if (ageDays > WINDOW_DAYS) return "deny";
  if (request.deliveredAt === null) return "approve";
  if (request.previousRefunds >= 3) return "manual_review";
  if (request.amountCents > AUTO_APPROVE_MAX_CENTS) return "manual_review";
  return "manual_review";
}

// Everything under the auto-approve cap still lands in the queue because the policy only pays out
// for damaged, defective, wrong, or undelivered items and someone has to read the reason text to
// tell those apart from change-of-mind requests. Queue volume is about 400 a day.
