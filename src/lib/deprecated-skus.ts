/**
 * Deprecated SKU Registry
 * ----------------------------------------------------------------------------
 * Single source of truth for products hidden from public selling.
 * Routes are NOT removed (preserves SEO + reversibility), but:
 *  1. AllServices.tsx + AutomationHub.tsx grids filter these out
 *  2. Each page should pass `noindex` to <SEOHead> based on this registry
 *
 * To revive a product: remove the entry below + remove `noindex` from its page.
 *
 * Why deprecated: every product here either (a) fails the "free ChatGPT in
 * an hour" test, (b) carries serious TCPA/FCRA/credit-repair liability,
 * (c) targets a B2C niche that distracts from the B2B SaaS thesis, or
 * (d) is a one-time tool dressed as a subscription (guaranteed churn).
 */

export interface DeprecatedSKU {
  /** route slug starting with "/" — must match the path in App.tsx */
  path: string;
  /** display name (matches AllServices.tsx `name` field) */
  name: string;
  /** short reason (one of: low-moat / tcpa-risk / b2c-misalign / commodity / churn-trap / wrong-vertical / regulatory-risk) */
  reason: string;
  /** ISO date deprecated */
  deprecated_at: string;
}

export const DEPRECATED_SKUS: DeprecatedSKU[] = [
  { path: "/social-media-ai",         name: "Social Media Automation",     reason: "commodity",        deprecated_at: "2026-04-23" },
  { path: "/pet-memorial",            name: "Pet Memorial Service",        reason: "b2c-misalign",     deprecated_at: "2026-04-23" },
  { path: "/b2b-leads",               name: "B2B Dental Database",         reason: "wrong-vertical",   deprecated_at: "2026-04-23" },
  { path: "/tech-support",            name: "Local Tech Support",          reason: "linear-time",      deprecated_at: "2026-04-23" },
  { path: "/employee-handbook",       name: "Employee Handbook",           reason: "churn-trap",       deprecated_at: "2026-04-23" },
  { path: "/blog-post-writer",        name: "Blog Post Writer",            reason: "commodity",        deprecated_at: "2026-04-23" },
  { path: "/ai-newsletter",           name: "AI Newsletter",               reason: "low-moat",         deprecated_at: "2026-04-23" },
  { path: "/insurance-drip",          name: "Insurance Lead Drip",         reason: "tcpa-risk",        deprecated_at: "2026-04-23" },
  { path: "/credit-dispute-letters",  name: "Credit Dispute Letters",      reason: "regulatory-risk",  deprecated_at: "2026-04-23" },
  { path: "/hoa-letters",             name: "HOA Violation Letters",       reason: "regulatory-risk",  deprecated_at: "2026-04-23" },
  { path: "/medical-bill-dispute",    name: "Medical Bill Dispute",        reason: "b2c-misalign",     deprecated_at: "2026-04-23" },
  { path: "/menu-engineering",        name: "Restaurant Menu Engineering", reason: "wrong-vertical",   deprecated_at: "2026-04-23" },
  { path: "/trade-show-followup",     name: "Trade Show Follow-Up",        reason: "seasonal",         deprecated_at: "2026-04-23" },
  { path: "/late-payment-collector",  name: "Late Payment Collector",      reason: "feature-overlap",  deprecated_at: "2026-04-23" },
  { path: "/real-estate-newsletter",  name: "Real Estate Newsletter",      reason: "high-churn",       deprecated_at: "2026-04-23" },
  { path: "/ai-linkedin-ghostwriter", name: "AI LinkedIn Ghostwriter",     reason: "commodity",        deprecated_at: "2026-04-23" },
  { path: "/ai-sermon-prep",          name: "AI Sermon Prep",              reason: "low-moat",         deprecated_at: "2026-04-23" },
  { path: "/faq-refresh",             name: "FAQ Refresh",                 reason: "feature-not-product", deprecated_at: "2026-04-23" },
  { path: "/childrens-stories",       name: "Children's Story Subscription", reason: "b2c-misalign",   deprecated_at: "2026-04-23" },
  { path: "/meeting-prep",            name: "Meeting Prep",                reason: "low-acv",          deprecated_at: "2026-04-23" },
];

const DEPRECATED_PATHS = new Set(DEPRECATED_SKUS.map(s => s.path.toLowerCase()));
const DEPRECATED_NAMES = new Set(DEPRECATED_SKUS.map(s => s.name.toLowerCase().trim()));

/** Check if a route path is deprecated (case-insensitive). */
export function isDeprecatedPath(path: string | undefined | null): boolean {
  if (!path) return false;
  return DEPRECATED_PATHS.has(path.toLowerCase());
}

/** Check if a product display name is deprecated. */
export function isDeprecatedName(name: string | undefined | null): boolean {
  if (!name) return false;
  return DEPRECATED_NAMES.has(name.toLowerCase().trim());
}

/** Filter helper for service/grid arrays — returns true when item should be SHOWN. */
export function isPublicSku<T extends { url?: string; path?: string; name?: string }>(item: T): boolean {
  if (isDeprecatedPath(item.url ?? item.path)) return false;
  if (isDeprecatedName(item.name)) return false;
  return true;
}
