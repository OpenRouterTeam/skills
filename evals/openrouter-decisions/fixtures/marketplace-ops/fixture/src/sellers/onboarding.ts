export type SellerApplication = {
  id: string;
  businessName: string;
  description: string;
  categories: string[];
  identityVerified: boolean;
  bankVerified: boolean;
  country: string;
};

export type OnboardingOutcome = "approve" | "reject" | "review";

const RESTRICTED_CATEGORIES = new Set(["tobacco", "alcohol", "pharmacy", "weapons", "gambling"]);

export function screenApplication(app: SellerApplication): OnboardingOutcome {
  if (!app.identityVerified || !app.bankVerified) return "reject";
  if (app.categories.some((c) => RESTRICTED_CATEGORIES.has(c))) return "reject";
  return "review";
}

// Every verified application waits for a person to read the description and decide whether the
// business is what it says it is: a real shop selling permitted goods, versus a dropshipper
// relabelling restricted products, a ticket reseller, or a description that is boilerplate with
// no actual business behind it. Reviewers approve about 85% and the backlog is three days.
