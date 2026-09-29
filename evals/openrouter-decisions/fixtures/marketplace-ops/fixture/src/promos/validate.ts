export type Coupon = {
  code: string;
  startsAt: string;
  endsAt: string;
  minSpendCents: number;
  maxUses: number;
  uses: number;
  categories: string[] | null;
};

export type Cart = { subtotalCents: number; categories: string[] };

export type CouponError = "expired" | "not_started" | "exhausted" | "below_minimum" | "category_mismatch";

export function validateCoupon(coupon: Coupon, cart: Cart, now: string): CouponError | null {
  const t = Date.parse(now);
  if (t < Date.parse(coupon.startsAt)) return "not_started";
  if (t > Date.parse(coupon.endsAt)) return "expired";
  if (coupon.uses >= coupon.maxUses) return "exhausted";
  if (cart.subtotalCents < coupon.minSpendCents) return "below_minimum";
  if (coupon.categories !== null && !cart.categories.some((c) => coupon.categories!.includes(c))) return "category_mismatch";
  return null;
}
