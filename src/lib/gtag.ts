// Google Ads conversion tracking utility
// GA4: G-PDLSP336FJ (already in index.html)
// Google Ads: Set AW-XXXXXXXXX once you have your Google Ads conversion ID

import { trackFbLead, trackFbInitiateCheckout } from "./fbpixel";

const ADS_ID = ""; // TODO: Replace with your Google Ads conversion ID (AW-XXXXXXXXX)

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/** Fire a Google Ads conversion event */
export function trackConversion(conversionLabel: string, value?: number, currency = "USD") {
  if (typeof window === "undefined" || !window.gtag || !ADS_ID) return;
  window.gtag("event", "conversion", {
    send_to: `${ADS_ID}/${conversionLabel}`,
    value: value ?? 0,
    currency,
  });
}

/** Fire a GA4 custom event (works immediately with existing GA4 tag) */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
}

/** Track a lead capture form submission (GA4 + Facebook) */
export function trackLeadCapture(source: string, value = 0) {
  trackEvent("generate_lead", { event_category: "lead", event_label: source, value });
  trackConversion("lead_capture", value);
  trackFbLead(source, value);
}

/** Track a checkout initiation (GA4 + Facebook) */
export function trackCheckoutStart(service: string, value: number) {
  trackEvent("begin_checkout", { event_category: "ecommerce", event_label: service, value, currency: "USD" });
  trackConversion("checkout_start", value);
  trackFbInitiateCheckout(value, service);
}
