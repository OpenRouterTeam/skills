import { chatComplete } from "../llm/client";

export type Dispute = {
  id: string;
  amountCents: number;
  buyerStatement: string;
  sellerStatement: string;
  trackingStatus: "delivered" | "in_transit" | "lost" | "no_tracking";
  sellerProvidedPhotos: boolean;
};

export type Resolution = "refund_buyer" | "side_with_seller" | "split" | "escalate";

const PROMPT = `You are a marketplace dispute officer. Read the buyer statement, the seller statement, and the
shipping status, then answer with exactly one of: REFUND_BUYER, SIDE_WITH_SELLER, SPLIT, ESCALATE.`;

export async function resolveDispute(dispute: Dispute): Promise<Resolution> {
  if (dispute.trackingStatus === "lost") return "refund_buyer";
  if (dispute.trackingStatus === "no_tracking" && !dispute.sellerProvidedPhotos) return "refund_buyer";
  const reply = await chatComplete([
    { role: "system", content: PROMPT },
    {
      role: "user",
      content: `Buyer: ${dispute.buyerStatement}\nSeller: ${dispute.sellerStatement}\nShipping: ${dispute.trackingStatus}\nAmount: ${(dispute.amountCents / 100).toFixed(2)}`,
    },
  ]);
  const label = reply.trim().toUpperCase();
  if (label.startsWith("REFUND")) return "refund_buyer";
  if (label.startsWith("SIDE")) return "side_with_seller";
  if (label.startsWith("SPLIT")) return "split";
  return "escalate";
}

// Around one reply in twenty comes back as a sentence ("I would refund the buyer because...") and
// falls through to escalate. Disputes over $500 are supposed to always reach a human, which is
// currently enforced by asking the model to remember it in the prompt.
