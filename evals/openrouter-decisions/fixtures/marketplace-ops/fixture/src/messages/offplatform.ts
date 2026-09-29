export type BuyerSellerMessage = {
  id: string;
  fromAccountAgeDays: number;
  body: string;
};

export type MessageAction = "deliver" | "warn" | "block";

const URL_PATTERN = /https?:\/\/\S+|\bwww\.\S+/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;
const PAYMENT_TERMS = ["paypal", "venmo", "zelle", "cash app", "wire", "bank transfer", "off the app", "outside the app", "avoid fees"];

export function screenMessage(message: BuyerSellerMessage): MessageAction {
  const body = message.body.toLowerCase();
  const urls = message.body.match(URL_PATTERN)?.length ?? 0;
  const phones = message.body.match(PHONE_PATTERN)?.length ?? 0;
  if (message.fromAccountAgeDays < 1 && (urls > 0 || phones > 0)) return "block";
  if (PAYMENT_TERMS.some((term) => body.includes(term))) return "warn";
  if (urls + phones > 0) return "warn";
  return "deliver";
}

// The policy is about intent: asking to pay or continue the conversation off the platform. A
// buyer writing "I paid through the app, not PayPal" gets a warning banner; "let's take this to
// my email, I will send the address" sails through.
