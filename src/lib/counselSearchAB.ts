/**
 * A/B testing utility for Counsel Records Search pricing/onboarding.
 * Buckets users into "control" (Solo highlighted) vs "monitoring" (Monitoring highlighted)
 * and tracks conversion + time-to-first-search via PostHog.
 */
import { trackEvent } from "@/lib/posthog";

const KEY = "counsel_search_ab_variant";
const FIRST_SEARCH_KEY = "counsel_search_first_search_at";
const VISIT_KEY = "counsel_search_first_visit_at";

export type CounselABVariant = "highlight_solo" | "highlight_monitoring";

export function getCounselVariant(): CounselABVariant {
  if (typeof window === "undefined") return "highlight_monitoring";
  let v = localStorage.getItem(KEY) as CounselABVariant | null;
  if (!v) {
    v = Math.random() < 0.5 ? "highlight_solo" : "highlight_monitoring";
    localStorage.setItem(KEY, v);
    localStorage.setItem(VISIT_KEY, new Date().toISOString());
    trackEvent("counsel_search_variant_assigned", { variant: v });
  }
  return v;
}

export function trackCounselCheckoutStarted(tier: "solo" | "monitoring") {
  trackEvent("counsel_search_checkout_started", {
    tier,
    variant: localStorage.getItem(KEY),
  });
}

export function trackCounselFirstSearch() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(FIRST_SEARCH_KEY)) return;
  const visitAt = localStorage.getItem(VISIT_KEY);
  const now = new Date();
  localStorage.setItem(FIRST_SEARCH_KEY, now.toISOString());
  const ttfs = visitAt ? (now.getTime() - new Date(visitAt).getTime()) / 1000 : null;
  trackEvent("counsel_search_first_search", {
    variant: localStorage.getItem(KEY),
    time_to_first_search_seconds: ttfs,
  });
}
