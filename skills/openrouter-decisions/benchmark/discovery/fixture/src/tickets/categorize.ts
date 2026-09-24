export type Category = "billing" | "account_access" | "bug" | "feature_request" | "general";

export type InboundTicket = {
  id: string;
  subject: string;
  body: string;
  customerPlan: "free" | "pro" | "enterprise";
};

const BILLING_WORDS = ["invoice", "charged", "refund", "payment", "card", "subscription", "price"];
const ACCESS_WORDS = ["login", "log in", "password", "2fa", "locked out", "sign in", "reset"];
const BUG_WORDS = ["error", "crash", "broken", "doesn't work", "does not work", "bug", "500", "stack trace"];
const FEATURE_WORDS = ["would be nice", "feature", "could you add", "wish", "suggestion", "please add"];

function countHits(text: string, words: string[]): number {
  return words.filter((w) => text.includes(w)).length;
}

export function categorize(ticket: InboundTicket): Category {
  const text = `${ticket.subject} ${ticket.body}`.toLowerCase();
  const scores: [Category, number][] = [
    ["billing", countHits(text, BILLING_WORDS)],
    ["account_access", countHits(text, ACCESS_WORDS)],
    ["bug", countHits(text, BUG_WORDS)],
    ["feature_request", countHits(text, FEATURE_WORDS)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  if (scores[0][1] === 0) return "general";
  if (scores[0][1] === scores[1][1]) return "general";
  return scores[0][0];
}
