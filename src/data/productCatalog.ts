/**
 * DWA Product Catalog — single source of truth for the Predictive Sales umbrella
 * + industry → recommended-products decision matrix.
 *
 * Used by:
 *  - src/pages/PredictiveSales.tsx (umbrella landing + matrix)
 *  - Owner Dashboard "Recommended for your industry" widget
 *  - Sales scripts / proposal generators
 *
 * Mirrored in DB table `dwa_product_catalog` for admin-editable copy.
 */

export type ProductSlug =
  | "demand_radar"
  | "buyer_radar"
  | "industry_pulse"
  | "site_radar"
  | "tech_alert"
  | "mortgage_radar"
  | "missed_call"
  | "field_desk";

export interface ProductDef {
  slug: ProductSlug;
  /** Public-facing umbrella name (Predictive Sales family) */
  umbrellaName: string;
  /** Original/legacy product name — kept for code/Stripe metadata */
  legacyName: string;
  /** One-sentence value prop */
  tagline: string;
  /** $/mo retail */
  monthlyPrice: number;
  /** Route to product page */
  route: string;
  /** Industries where this product fits well */
  recommendedIndustries: string[];
  /** Industries where this product should be HIDDEN from recommendations */
  excludedIndustries: string[];
  /** Predictive Sales family member? (vs. ops tools like FieldDesk) */
  inPredictiveFamily: boolean;
}

export const INDUSTRIES = [
  "Boiler Service",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Contractor",
  "Mortgage Broker",
  "Real Estate",
  "Auto Manufacturing",
  "Healthcare",
  "Field Service (multi-trade)",
  "Professional Services",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const PRODUCTS: ProductDef[] = [
  {
    slug: "demand_radar",
    umbrellaName: "Predictive Sales — Active Buyers Right Now",
    legacyName: "Demand Radar",
    tagline:
      "Live RFPs, bid awards, and procurement signals from MITN, BidNet, and 40+ public sources — texted to you the moment they post.",
    monthlyPrice: 149,
    route: "/demand-radar",
    recommendedIndustries: [
      "Boiler Service",
      "HVAC",
      "Plumbing",
      "Electrical",
      "Roofing",
      "General Contractor",
      "Field Service (multi-trade)",
    ],
    excludedIndustries: ["Mortgage Broker", "Real Estate"],
    inPredictiveFamily: true,
  },
  {
    slug: "buyer_radar",
    umbrellaName: "Predictive Sales — Companies in Buying Mode",
    legacyName: "Buyer Radar",
    tagline:
      "Spot companies showing buying intent before they reach out — funding rounds, expansion permits, leadership changes, hiring surges.",
    monthlyPrice: 199,
    route: "/buyer-radar",
    recommendedIndustries: [
      "Boiler Service",
      "HVAC",
      "Electrical",
      "General Contractor",
      "Auto Manufacturing",
      "Professional Services",
    ],
    excludedIndustries: ["Mortgage Broker", "Real Estate"],
    inPredictiveFamily: true,
  },
  {
    slug: "industry_pulse",
    umbrellaName: "Predictive Sales — Market Trend Map",
    legacyName: "Industry Pulse / Growth Radar",
    tagline:
      "See which sub-segments of your market are heating up week-over-week. Permit velocity, hiring trends, capital flows.",
    monthlyPrice: 99,
    route: "/industry-pulse",
    recommendedIndustries: [
      "Boiler Service",
      "HVAC",
      "Plumbing",
      "Electrical",
      "Roofing",
      "General Contractor",
      "Auto Manufacturing",
    ],
    excludedIndustries: [],
    inPredictiveFamily: true,
  },
  {
    slug: "site_radar",
    umbrellaName: "Predictive Sales — Who's on YOUR Site Right Now",
    legacyName: "SiteRadar",
    tagline:
      "Identify the company behind every visitor instantly. Surface the most likely decision-maker. Get an SMS when a hot account returns.",
    monthlyPrice: 49,
    route: "/site-radar",
    recommendedIndustries: [
      "Boiler Service",
      "HVAC",
      "Plumbing",
      "Electrical",
      "Roofing",
      "General Contractor",
      "Professional Services",
      "Healthcare",
      "Field Service (multi-trade)",
    ],
    excludedIndustries: [],
    inPredictiveFamily: true,
  },
  {
    slug: "tech_alert",
    umbrellaName: "Predictive Hiring (license-gated trades only)",
    legacyName: "TechAlert / Talent Radar",
    tagline:
      "Get notified the moment a licensed tech in your trade becomes available — state licensing records + proprietary OSINT.",
    monthlyPrice: 149,
    route: "/talent-radar",
    // License-gated trades only. Boiler service is gated, but DJ Conley is staffed.
    recommendedIndustries: ["HVAC", "Plumbing", "Electrical"],
    excludedIndustries: [
      "Boiler Service",
      "Mortgage Broker",
      "Real Estate",
      "Professional Services",
      "Healthcare",
      "Roofing",
      "General Contractor",
      "Auto Manufacturing",
      "Field Service (multi-trade)",
    ],
    inPredictiveFamily: true,
  },
  {
    slug: "mortgage_radar",
    umbrellaName: "Predictive Sales — Mortgage Lead Radar",
    legacyName: "Mortgage Radar",
    tagline:
      "FSBO listings, court records, and SOS filings — homeowner intent signals for licensed mortgage brokers.",
    monthlyPrice: 149,
    route: "/mortgage-radar",
    recommendedIndustries: ["Mortgage Broker", "Real Estate"],
    excludedIndustries: [
      "Boiler Service",
      "HVAC",
      "Plumbing",
      "Electrical",
      "Roofing",
      "General Contractor",
      "Auto Manufacturing",
      "Healthcare",
      "Field Service (multi-trade)",
      "Professional Services",
    ],
    inPredictiveFamily: true,
  },
  {
    slug: "missed_call",
    umbrellaName: "Missed-Call Catch + Review Texts",
    legacyName: "Missed-Call Catch",
    tagline:
      "Auto-text every missed call within 60 seconds. Recovers ~38% of lost leads. Auto-asks happy customers for a Google review.",
    monthlyPrice: 99,
    route: "/missed-call",
    recommendedIndustries: [...INDUSTRIES],
    excludedIndustries: [],
    inPredictiveFamily: false,
  },
  {
    slug: "field_desk",
    umbrellaName: "FieldDesk — Dispatch + GPS + Customer SMS",
    legacyName: "FieldDesk",
    tagline:
      "$199/mo flat for unlimited techs. Dispatch board, live GPS, auto-SMS to customers. Or run as a Marketing Layer on top of eWay.",
    monthlyPrice: 199,
    route: "/field-service",
    recommendedIndustries: [
      "Boiler Service",
      "HVAC",
      "Plumbing",
      "Electrical",
      "Roofing",
      "General Contractor",
      "Field Service (multi-trade)",
    ],
    excludedIndustries: ["Mortgage Broker", "Real Estate", "Professional Services"],
    inPredictiveFamily: false,
  },
];

export function getProductsForIndustry(industry: Industry | string): {
  recommended: ProductDef[];
  excluded: ProductDef[];
} {
  const recommended = PRODUCTS.filter((p) => p.recommendedIndustries.includes(industry));
  const excluded = PRODUCTS.filter((p) => p.excludedIndustries.includes(industry));
  return { recommended, excluded };
}

export function getPredictiveFamily(): ProductDef[] {
  return PRODUCTS.filter((p) => p.inPredictiveFamily);
}
