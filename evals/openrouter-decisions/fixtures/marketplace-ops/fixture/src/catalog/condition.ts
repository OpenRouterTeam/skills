export type Condition = "new" | "like_new" | "good" | "fair" | "for_parts";

export type ConditionCheck = {
  listingId: string;
  declared: Condition;
  description: string;
};

export type ConditionVerdict = "accept" | "flag";

const ORDER: Condition[] = ["for_parts", "fair", "good", "like_new", "new"];

const HINTS: [Condition, string[]][] = [
  ["for_parts", ["doesn't turn on", "does not turn on", "for parts", "not working", "spares"]],
  ["fair", ["heavy wear", "scratches", "dents", "stains", "worn"]],
  ["good", ["light wear", "minor", "small mark", "used"]],
  ["like_new", ["barely used", "like new", "mint", "opened once"]],
  ["new", ["sealed", "brand new", "unopened", "tags attached"]],
];

function describedCondition(description: string): Condition | null {
  const text = description.toLowerCase();
  for (const [condition, terms] of HINTS) {
    if (terms.some((term) => text.includes(term))) return condition;
  }
  return null;
}

export function checkCondition(check: ConditionCheck): ConditionVerdict {
  const described = describedCondition(check.description);
  if (described === null) return "accept";
  return ORDER.indexOf(described) < ORDER.indexOf(check.declared) ? "flag" : "accept";
}

// Sellers declare "like new" and then write "a few scratches on the back, works fine". The hint
// list catches the word scratches and flags it as fair, but "the box has a small dent, item itself
// is sealed" is also flagged, and "screen cracked but everything else pristine" is accepted.
