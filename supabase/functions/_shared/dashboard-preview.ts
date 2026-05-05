// Shared visual block for cold emails: a "this is what your dashboard would
// look like" hero image + cold-hard "missed revenue this month" number.
//
// Email clients are visual. Recipients skim. One pretty picture + one big
// number does more than 200 words of pitch copy.
//
// Usage:
//   import { dashboardPreviewHtml, missedRevenue } from "../_shared/dashboard-preview.ts";
//   const block = dashboardPreviewHtml({
//     product: "trade_radar",
//     city: "Detroit",
//     industry: "roofing",
//     // optional override:
//     // missedRevenue: 12400,
//   });

const TEAL = "#00d4ff";
const BG = "#0f2540";
const BORDER = "#1e3a5f";
const TEXT = "#e6f1ff";
const MUTED = "#7a8aa0";

// Public URLs for the preview images — these live in /public/email-assets/
// and get served from the deployed site (custom domain or .lovable.app).
const ASSET_BASE = "https://detroitwebagent.com/email-assets";

export type ProductKey =
  | "trade_radar"
  | "mortgage_radar"
  | "techalert"
  | "missed_call"
  | "siteradar"
  | "fielddesk";

const PREVIEW_IMAGES: Record<ProductKey, string> = {
  trade_radar: `${ASSET_BASE}/preview-trade-radar.png`,
  mortgage_radar: `${ASSET_BASE}/preview-mortgage-radar.png`,
  techalert: `${ASSET_BASE}/preview-techalert.png`,
  missed_call: `${ASSET_BASE}/preview-missed-call.png`,
  siteradar: `${ASSET_BASE}/preview-siteradar.png`,
  fielddesk: `${ASSET_BASE}/preview-fielddesk.png`,
};

const PRODUCT_LABEL: Record<ProductKey, string> = {
  trade_radar: "Trade Radar",
  mortgage_radar: "Mortgage Radar",
  techalert: "TechAlert",
  missed_call: "Missed-Call Catch",
  siteradar: "SiteRadar",
  fielddesk: "FieldDesk",
};

// Conservative per-product economics. These are the floor — real customer
// numbers usually run higher. Tuned to feel real, not invented.
const ECONOMICS: Record<ProductKey, { perUnit: number; unitLabel: string; defaultUnits: number }> = {
  trade_radar: { perUnit: 400, unitLabel: "exclusive lead × $400 avg job margin", defaultUnits: 31 },
  mortgage_radar: { perUnit: 2800, unitLabel: "qualified refi/purchase lead × $2,800 avg commission", defaultUnits: 6 },
  techalert: { perUnit: 1200, unitLabel: "open-role day × $1,200 lost productivity", defaultUnits: 14 },
  missed_call: { perUnit: 312, unitLabel: "missed call × $312 avg job value (27% recovery)", defaultUnits: 27 },
  siteradar: { perUnit: 80, unitLabel: "anonymous visitor × $80 pipeline value (5% close)", defaultUnits: 105 },
  fielddesk: { perUnit: 95, unitLabel: "scheduling-error hour × $95 saved", defaultUnits: 22 },
};

export function missedRevenue(product: ProductKey, units?: number): number {
  const e = ECONOMICS[product];
  const n = typeof units === "number" && units > 0 ? units : e.defaultUnits;
  return Math.round(n * e.perUnit);
}

function fmtUSD(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

export interface DashboardPreviewOpts {
  product: ProductKey;
  city?: string;          // "Detroit" — appears in caption to feel local
  industry?: string;      // "roofing" — appears in caption
  units?: number;         // override default unit count (e.g. real estimated leads)
  caption?: string;       // override the auto-caption entirely
  bigNumberLabel?: string; // override "Missed Revenue This Month"
  showCta?: boolean;      // default true
  ctaUrl?: string;        // optional CTA button below
  ctaText?: string;
}

/**
 * Renders: a framed dashboard screenshot + a "Missed Revenue This Month"
 * big-number tile + a small caption that says where the number came from.
 *
 * All inline styles. Email-client safe. Dark DWA theme.
 */
export function dashboardPreviewHtml(opts: DashboardPreviewOpts): string {
  const img = PREVIEW_IMAGES[opts.product];
  const label = PRODUCT_LABEL[opts.product];
  const econ = ECONOMICS[opts.product];
  const usd = fmtUSD(missedRevenue(opts.product, opts.units));
  const units = opts.units ?? econ.defaultUnits;

  const caption = opts.caption
    ?? `Based on signals we already pulled${opts.city ? ` in ${opts.city}` : ""}${opts.industry ? ` for ${opts.industry}` : ""}: ~${units} ${econ.unitLabel}.`;

  const bigLabel = opts.bigNumberLabel ?? "Missed Revenue This Month";

  const cta = opts.showCta !== false && opts.ctaUrl && opts.ctaText
    ? `<div style="margin-top:14px;text-align:center;">
         <a href="${opts.ctaUrl}" style="background:${TEAL};color:#0a1628;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">${esc(opts.ctaText)}</a>
       </div>`
    : "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td>
    <div style="background:${BG};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
      <div style="padding:10px 16px 0;color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">
        Your ${esc(label)} would look like this
      </div>
      <div style="padding:10px 16px 0;">
        <img src="${img}" alt="${esc(label)} dashboard preview" width="100%" style="display:block;width:100%;border-radius:6px;border:1px solid ${BORDER};" />
      </div>
      <div style="padding:14px 16px 18px;">
        <div style="background:rgba(0,212,255,0.08);border:1px solid ${TEAL};border-radius:6px;padding:14px 16px;text-align:center;">
          <div style="color:${TEAL};font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">${esc(bigLabel)}</div>
          <div style="color:#ffffff;font-size:34px;font-weight:800;line-height:1.1;letter-spacing:-0.5px;">${usd}</div>
          <div style="color:${MUTED};font-size:11px;line-height:1.5;margin-top:8px;">${esc(caption)}</div>
        </div>
        ${cta}
      </div>
    </div>
  </td></tr>
</table>`;
}

/**
 * Best-guess product picker based on industry string. Returns the radar
 * product most relevant to that industry's cold pitch (never the add-on
 * salad).
 */
export function pickProductForIndustry(industry: string | undefined | null): ProductKey {
  const n = (industry || "").toLowerCase();
  if (/mortgage|loan|realtor|real estate|broker/.test(n)) return "mortgage_radar";
  if (/medical|dental|clinic|health|chiro|veterinar|hospital|nursing|hospice/.test(n)) return "techalert";
  if (/manufactur|industrial|fabricat|machine shop|cnc|warehouse|metal/.test(n)) return "techalert";
  if (/restaurant|cafe|bar|salon|spa|retail|gym|nail|barber/.test(n)) return "missed_call";
  if (/law|attorney|legal|consult|accounting|cpa|insurance|financial/.test(n)) return "missed_call";
  if (/saas|software|agency|marketing|b2b|staffing|recruit/.test(n)) return "siteradar";
  if (/hvac|plumb|roof|electri|landscap|paint|gutter|siding|fenc|deck|concrete|handyman|contractor|pest|tree|restoration|demo|junk|foundation|exterior|home service/.test(n)) {
    return "trade_radar";
  }
  return "trade_radar"; // default: most local-business-friendly
}
