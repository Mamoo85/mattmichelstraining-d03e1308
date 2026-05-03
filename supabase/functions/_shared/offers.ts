// Single source of truth for trial + intro discount offers.
// NEVER hardcode trial days, discount %, or prices outside this file.
// Updated: 2026-05-03 — per Matt's HBS-grade audit directive.

export const TRIAL_DAYS = 7;
export const INTRO_DISCOUNT_PCT = 50;
export const INTRO_DISCOUNT_MONTHS = 3;
export const INTRO_COUPON_ID = "s5f2M1Vq"; // Stripe coupon: INTRO50_3MO (50% off, repeating, 3 months)
export const DEAD_LEAD_FIRST_YES_FREE = true;

export type ProductKey =
  | "mortgage_radar"
  | "trade_radar"
  | "field_desk"
  | "site_radar"
  | "missed_call_catch"
  | "phone_answering"
  | "bundle_revenue_suite"
  | "techalert"
  | "contractor_leads"
  | "dead_lead";

export interface OfferConfig {
  productKey: ProductKey;
  displayName: string;
  monthlyPriceCents: number;
  trialEligible: boolean; // 7-day no-CC trial
  introDiscountEligible: boolean; // 50% off first 3 months coupon
  notes?: string;
}

export const OFFERS: Record<ProductKey, OfferConfig> = {
  mortgage_radar: {
    productKey: "mortgage_radar",
    displayName: "Mortgage Radar",
    monthlyPriceCents: 39900,
    trialEligible: true,
    introDiscountEligible: true,
  },
  trade_radar: {
    productKey: "trade_radar",
    displayName: "Trade Radar",
    monthlyPriceCents: 14900,
    trialEligible: true,
    introDiscountEligible: true,
    notes: "Per-vertical pricing varies; this is the default.",
  },
  field_desk: {
    productKey: "field_desk",
    displayName: "FieldDesk",
    monthlyPriceCents: 19900,
    trialEligible: true,
    introDiscountEligible: true,
  },
  site_radar: {
    productKey: "site_radar",
    displayName: "SiteRadar",
    monthlyPriceCents: 4900,
    trialEligible: true,
    introDiscountEligible: true,
  },
  missed_call_catch: {
    productKey: "missed_call_catch",
    displayName: "Missed-Call Catch",
    monthlyPriceCents: 9900,
    trialEligible: true,
    introDiscountEligible: true,
  },
  phone_answering: {
    productKey: "phone_answering",
    displayName: "AI Phone Answering",
    monthlyPriceCents: 14900,
    trialEligible: true,
    introDiscountEligible: true,
  },
  bundle_revenue_suite: {
    productKey: "bundle_revenue_suite",
    displayName: "Bundle: Revenue Suite",
    monthlyPriceCents: 29900,
    trialEligible: true,
    introDiscountEligible: true,
  },
  techalert: {
    productKey: "techalert",
    displayName: "TechAlert (Hiring Radar)",
    monthlyPriceCents: 14900,
    trialEligible: false, // hiring radar — NO trial per Matt directive
    introDiscountEligible: false,
  },
  contractor_leads: {
    productKey: "contractor_leads",
    displayName: "Contractor Leads",
    monthlyPriceCents: 39900,
    trialEligible: false, // exempted per Matt directive
    introDiscountEligible: false,
  },
  dead_lead: {
    productKey: "dead_lead",
    displayName: "Dead Lead Reactivation",
    monthlyPriceCents: 0, // pay-per-yes, $50/positive reply
    trialEligible: false,
    introDiscountEligible: false,
    notes: "First positive reply is FREE; subsequent yes = $50 each.",
  },
};

/**
 * Returns the Stripe `subscription_data` block for a checkout session,
 * applying trial + coupon based on product offer config.
 */
export function buildSubscriptionData(
  productKey: ProductKey,
  overrides?: Partial<{ trial: boolean; coupon: boolean }>,
): Record<string, unknown> {
  const offer = OFFERS[productKey];
  const wantTrial = overrides?.trial ?? offer.trialEligible;
  const wantCoupon = overrides?.coupon ?? offer.introDiscountEligible;
  const data: Record<string, unknown> = {};
  if (wantTrial) {
    data.trial_period_days = TRIAL_DAYS;
    data.trial_settings = { end_behavior: { missing_payment_method: "cancel" } };
  }
  return data;
}

/**
 * Stripe checkout `discounts` array for the intro coupon (or undefined if not eligible).
 */
export function buildDiscounts(productKey: ProductKey): Array<{ coupon: string }> | undefined {
  const offer = OFFERS[productKey];
  if (!offer.introDiscountEligible) return undefined;
  return [{ coupon: INTRO_COUPON_ID }];
}

/**
 * For no-CC trial flows, set this on checkout sessions.
 * Stripe requires `payment_method_collection: "if_required"` to skip the card form.
 */
export function paymentMethodCollection(productKey: ProductKey): "if_required" | "always" {
  return OFFERS[productKey].trialEligible ? "if_required" : "always";
}

/**
 * Customer-facing offer copy for use in email/fax/postcard/SMS templates.
 */
export function offerCopy(productKey: ProductKey): {
  headline: string;
  shortPitch: string;
  ctaLabel: string;
  ctaPath: string;
} {
  const offer = OFFERS[productKey];
  if (productKey === "dead_lead") {
    return {
      headline: "Your first positive reply is on us.",
      shortPitch: "We re-text your dead leads. First yes is FREE — $50/yes after that.",
      ctaLabel: "Activate dead leads",
      ctaPath: `/start-trial?product=${productKey}`,
    };
  }
  if (offer.trialEligible) {
    return {
      headline: `${TRIAL_DAYS}-day free trial — no credit card required.`,
      shortPitch: `Try ${offer.displayName} free for ${TRIAL_DAYS} days. After that, ${INTRO_DISCOUNT_PCT}% off your first ${INTRO_DISCOUNT_MONTHS} months.`,
      ctaLabel: `Start ${TRIAL_DAYS}-day free trial`,
      ctaPath: `/start-trial?product=${productKey}`,
    };
  }
  return {
    headline: `Get started with ${offer.displayName}`,
    shortPitch: `${offer.displayName} — $${(offer.monthlyPriceCents / 100).toFixed(0)}/mo.`,
    ctaLabel: "See pricing",
    ctaPath: `/start-trial?product=${productKey}`,
  };
}
