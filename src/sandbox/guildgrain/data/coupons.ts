export interface Coupon {
  code: string;
  label: string;
  apply: (subtotal: number, shipping: number) => { discount: number; shipping: number; reason?: string };
  validate?: (subtotal: number) => string | null; // returns error or null
}

export const COUPONS: Record<string, Coupon> = {
  VOLUME10: {
    code: "VOLUME10",
    label: "10% off your order",
    apply: (subtotal, shipping) => ({ discount: Math.round(subtotal * 10) / 100, shipping }),
  },
  GRAIN15: {
    code: "GRAIN15",
    label: "15% off orders $75+",
    validate: (subtotal) => (subtotal < 75 ? "GRAIN15 needs a $75 minimum" : null),
    apply: (subtotal, shipping) => ({ discount: Math.round(subtotal * 15) / 100, shipping }),
  },
  FIRSTGIFT: {
    code: "FIRSTGIFT",
    label: "Free shipping",
    apply: (subtotal, _shipping) => ({ discount: 0, shipping: 0, reason: "Free shipping applied" }),
  },
};

export function resolveCoupon(code: string | null, subtotal: number, shipping: number) {
  if (!code) return { discount: 0, shipping, applied: null as Coupon | null, error: null as string | null };
  const coupon = COUPONS[code.toUpperCase()];
  if (!coupon) return { discount: 0, shipping, applied: null, error: "Coupon not recognised" };
  if (coupon.validate) {
    const err = coupon.validate(subtotal);
    if (err) return { discount: 0, shipping, applied: null, error: err };
  }
  const r = coupon.apply(subtotal, shipping);
  return { discount: r.discount, shipping: r.shipping, applied: coupon, error: null };
}
