export type ProductReview = {
  id: string;
  text: string;
  rating: number;
  hasPhoto: boolean;
  helpfulVotes: number;
  verifiedPurchase: boolean;
};

export type Placement = "feature" | "show" | "bury";

export function placeReview(review: ProductReview): Placement {
  if (!review.verifiedPurchase) return review.text.length > 200 ? "show" : "bury";
  let points = 0;
  if (review.text.length > 300) points += 2;
  else if (review.text.length > 120) points += 1;
  if (review.hasPhoto) points += 1;
  if (review.helpfulVotes >= 5) points += 2;
  if (points >= 4) return "feature";
  if (points >= 1) return "show";
  return "bury";
}

// Featured reviews are supposed to tell a shopper something concrete about the product (fit,
// durability, what broke, how it compares). Length is a poor proxy: a 400-character rant about
// the courier gets featured and "Runs a half size small, otherwise perfect" gets buried.
