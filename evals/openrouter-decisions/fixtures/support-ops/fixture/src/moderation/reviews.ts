export type ProductReview = {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
};

export type ModerationResult = { publish: boolean; flags: string[] };

const PROFANITY = ["damn", "hell", "crap", "wtf", "bs"];
const PROMO_PATTERNS = [/https?:\/\//i, /discount code/i, /use code [A-Z0-9]{4,}/, /check out my/i, /\bdm me\b/i];
const HARASSMENT = ["idiot", "stupid", "moron", "loser"];

export function moderate(review: ProductReview): ModerationResult {
  const text = `${review.title} ${review.body}`;
  const lower = text.toLowerCase();
  const flags: string[] = [];
  if (PROFANITY.some((w) => lower.split(/\W+/).includes(w))) flags.push("profanity");
  if (PROMO_PATTERNS.some((re) => re.test(text))) flags.push("promotional");
  if (HARASSMENT.some((w) => lower.includes(w))) flags.push("harassment");
  if (review.body.trim().length < 12) flags.push("too_short");
  return { publish: flags.length === 0, flags };
}
