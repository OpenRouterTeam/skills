export type DraftListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  sellerStrikes: number;
};

export type ScreenResult = "publish" | "block" | "hold";

const WEAPON_TERMS = ["knife", "blade", "gun", "pistol", "rifle", "ammo", "taser", "pepper spray"];
const COUNTERFEIT_TERMS = ["replica", "inspired by", "aaa quality", "mirror quality", "unbranded version"];
const RECALLED_TERMS = ["recall", "recalled", "safety notice", "pre-ban"];

function mentions(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function screenListing(listing: DraftListing): ScreenResult {
  if (listing.sellerStrikes >= 3) return "hold";
  const text = `${listing.title} ${listing.description}`.toLowerCase();
  if (mentions(text, WEAPON_TERMS)) return "block";
  if (mentions(text, COUNTERFEIT_TERMS)) return "block";
  if (mentions(text, RECALLED_TERMS)) return "hold";
  return "publish";
}

// Trust and safety keeps adding terms. "Kitchen knife set" and "butter knife" are blocked, while
// "authentic Nike Air Max, very cheap, no box" slips through. Roughly 3% of new listings are
// appealed each week and most appeals succeed.
