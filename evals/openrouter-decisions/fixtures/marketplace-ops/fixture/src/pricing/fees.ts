export type SellerTier = "starter" | "pro" | "enterprise";

const COMMISSION: Record<SellerTier, number> = { starter: 0.12, pro: 0.09, enterprise: 0.06 };
const PAYMENT_FIXED_CENTS = 30;
const PAYMENT_RATE = 0.029;
const MIN_COMMISSION_CENTS = 50;

export type FeeBreakdown = { commissionCents: number; paymentCents: number; payoutCents: number };

export function computeFees(saleCents: number, tier: SellerTier): FeeBreakdown {
  const commissionCents = Math.max(MIN_COMMISSION_CENTS, Math.round(saleCents * COMMISSION[tier]));
  const paymentCents = PAYMENT_FIXED_CENTS + Math.round(saleCents * PAYMENT_RATE);
  return { commissionCents, paymentCents, payoutCents: Math.max(0, saleCents - commissionCents - paymentCents) };
}
