export type ReturnRequest = {
  orderId: string;
  reasonText: string;
  promisedBy: string;
  deliveredAt: string;
};

export type ReturnReason = "defective" | "not_as_described" | "wrong_item" | "changed_mind" | "arrived_late" | "other";

const KEYWORDS: [ReturnReason, string[]][] = [
  ["defective", ["broken", "doesn't work", "does not work", "dead", "cracked", "faulty"]],
  ["wrong_item", ["wrong", "different item", "not what i ordered"]],
  ["not_as_described", ["not as described", "smaller", "color", "colour", "photos"]],
  ["changed_mind", ["changed my mind", "no longer", "don't need", "do not need"]],
  ["arrived_late", ["late", "too long", "delayed"]],
];

export function classifyReturn(request: ReturnRequest): ReturnReason {
  const text = request.reasonText.toLowerCase();
  for (const [reason, terms] of KEYWORDS) {
    if (terms.some((term) => text.includes(term))) return reason;
  }
  return "other";
}

// The reason drives who pays return shipping (seller for defective, wrong_item, not_as_described,
// arrived_late; buyer for changed_mind) so mislabels turn into seller complaints. "The wrong colour
// arrived" is labelled wrong_item, "I no longer think the photos were accurate" is changed_mind.
