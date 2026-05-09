// Teaser email templates per DWA product, personalized with {company},
// {ceo_first_name}, {recent_signal}, {city}. Each ends in a 7-day free
// trial CTA via dwaColdEmail() (or 30-day for hiring radars).
//
// Usage:
//   import { renderTeaser, TEASER_PRODUCTS } from "../_shared/teaser-emails.ts";
//   const { subject, bodyHtml, ctaUrl, product } = renderTeaser("siteradar", vars);

import { DWA_TEAL } from "./dwa-email.ts";

export interface TeaserVars {
  company?: string;
  ceo_first_name?: string;
  recent_signal?: string;
  city?: string;
}

export interface TeaserTemplate {
  /** Internal slug — used by send-teaser-email */
  slug: string;
  /** Display name */
  product: string;
  /** Cold-email subject (supports {company} / {ceo_first_name}) */
  subject: string;
  /** Inner body HTML (no shell, no CTA — added by dwaColdEmail). Supports vars. */
  bodyHtml: string;
  /** Trial / landing URL */
  ctaUrl: string;
  /** template_name for email_send_log */
  templateName: string;
}

const HI = (v: TeaserVars) =>
  v.ceo_first_name ? `Hi ${escapeHtml(v.ceo_first_name)},` : "Hi there,";
const CO = (v: TeaserVars) =>
  v.company ? `<strong>${escapeHtml(v.company)}</strong>` : "your company";
const SIG = (v: TeaserVars) =>
  v.recent_signal ? escapeHtml(v.recent_signal) : "a recent buying signal in your market";
const CITY = (v: TeaserVars) => (v.city ? escapeHtml(v.city) : "your area");

export const TEASER_TEMPLATES: TeaserTemplate[] = [
  {
    slug: "siteradar",
    product: "SiteRadar",
    subject: "{company} — who's reading your site (and not calling)",
    templateName: "teaser-siteradar",
    ctaUrl: "https://detroitwebagent.com/site-radar",
    bodyHtml: `
<p>__HI__</p>
<p>I run <strong>SiteRadar</strong> — it watches __CO__'s website and tells you which <em>companies</em> are reading you. Not just "23 visitors today." Actual company names, the pages they read, and how often they came back.</p>
<p>Most B2B sites lose 95%+ of qualified traffic because the visitor never fills out a form. SiteRadar fixes that — you see who showed up, and you call them while they're still warm.</p>
<p>Recent trigger I noticed in your space: <span style="color:${DWA_TEAL};">__SIG__</span>. Worth seeing what hits when we point it at __CO__.</p>
<p>I'll spin up a 7-day trial on your domain — no card, no install (one script tag), and you'll see your first identified company within 24 hours.</p>`,
  },
  {
    slug: "missed-call",
    product: "Missed-Call Catch",
    subject: "{company} dropped a call last week — want to catch the next one?",
    templateName: "teaser-missed-call",
    ctaUrl: "https://detroitwebagent.com/missed-call",
    bodyHtml: `
<p>__HI__</p>
<p>Quick math on __CO__: if your shop misses 10 calls a week and 30% are real jobs, that's ~$15K/mo walking out the door because nobody's at the desk after 5pm.</p>
<p><strong>Missed-Call Catch</strong> auto-texts every missed call within 8 seconds: <em>"Hey, this is __CO__ — sorry we missed you. What's the address?"</em> Caller replies, you have a lead in writing, with their number, before they finish dialing your competitor.</p>
<p>Triggered by: <span style="color:${DWA_TEAL};">__SIG__</span> in __CITY__.</p>
<p>I'll set it up free for 7 days on your real number. If it doesn't pay for itself in the first week, kill it — no card on file.</p>`,
  },
  {
    slug: "demand-radar",
    product: "Demand Radar",
    subject: "{company} — live RFP feed for __CITY__",
    templateName: "teaser-demand-radar",
    ctaUrl: "https://detroitwebagent.com/demand-radar",
    bodyHtml: `
<p>__HI__</p>
<p><strong>Demand Radar</strong> scrapes 40+ public sources daily — SAM.gov, MITN, BidNet, county procurement portals, school district RFPs, hospital capex announcements — and surfaces only the bids that match __CO__'s trade and service area.</p>
<p>You stop paging through procurement portals at 11pm. The qualified RFPs land in your inbox at 6am with deadline, contact, and link.</p>
<p>Recent in __CITY__: <span style="color:${DWA_TEAL};">__SIG__</span>.</p>
<p>7-day free trial — I'll seed it with __CO__'s NAICS and ZIPs. First feed in your inbox tomorrow morning.</p>`,
  },
  {
    slug: "buyer-radar",
    product: "Buyer Radar",
    subject: "Who's actually buying what __CO__ sells right now",
    templateName: "teaser-buyer-radar",
    ctaUrl: "https://detroitwebagent.com/buyer-radar",
    bodyHtml: `
<p>__HI__</p>
<p><strong>Buyer Radar</strong> is the supplier-side version of Demand Radar. We watch permit filings, capex announcements, expansion press releases, and procurement signals — then surface the buyers about to need what __CO__ supplies, with the buyer name, project size, and timeline.</p>
<p>Trigger pattern that fits __CO__: <span style="color:${DWA_TEAL};">__SIG__</span>.</p>
<p>You skip the cold list. You call companies that already have budget approved.</p>
<p>7 days free, no card. I'll calibrate the signal mix for __CO__'s SKUs in 5 minutes on the call.</p>`,
  },
  {
    slug: "industry-pulse",
    product: "Industry Pulse",
    subject: "What __CITY__ competitors are quietly hiring for",
    templateName: "teaser-industry-pulse",
    ctaUrl: "https://detroitwebagent.com/industry-pulse",
    bodyHtml: `
<p>__HI__</p>
<p><strong>Industry Pulse</strong> tracks competitor hiring, trade-show appearances, new equipment filings, license expansions, and patent activity in __CO__'s vertical. You see who's about to outflank you 60–90 days before they show up at the same job site.</p>
<p>Latest signal in your lane: <span style="color:${DWA_TEAL};">__SIG__</span>.</p>
<p>This is the report I'd want every Monday morning if I ran __CO__. 7-day free trial — first weekly digest hits Monday 8am.</p>`,
  },
];

export const TEASER_PRODUCTS = TEASER_TEMPLATES.map((t) => t.slug);

export function renderTeaser(
  slug: string,
  vars: TeaserVars,
): { product: string; subject: string; bodyHtml: string; ctaUrl: string; templateName: string } | null {
  const t = TEASER_TEMPLATES.find((x) => x.slug === slug);
  if (!t) return null;
  return {
    product: t.product,
    subject: applyVars(t.subject, vars),
    bodyHtml: applyBody(t.bodyHtml, vars),
    ctaUrl: t.ctaUrl,
    templateName: t.templateName,
  };
}

function applyVars(s: string, v: TeaserVars): string {
  return s
    .replaceAll("{company}", v.company || "your company")
    .replaceAll("{ceo_first_name}", v.ceo_first_name || "there")
    .replaceAll("{recent_signal}", v.recent_signal || "a recent signal")
    .replaceAll("{city}", v.city || "your area")
    .replaceAll("__CITY__", v.city || "your area");
}

function applyBody(html: string, v: TeaserVars): string {
  return html
    .replaceAll("__HI__", HI(v))
    .replaceAll("__CO__", CO(v))
    .replaceAll("__SIG__", SIG(v))
    .replaceAll("__CITY__", CITY(v));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
