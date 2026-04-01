// Facebook Pixel tracking utility
// Pixel ID: 4303244103266841 (loaded via index.html)

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

const FB_PIXEL_ID = "4303244103266841";

/** Check if Facebook Pixel is available */
export function isFbPixelLoaded(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/** Track a standard Facebook Pixel event */
export function trackFbEvent(eventName: string, params?: Record<string, unknown>) {
  if (!isFbPixelLoaded()) return;
  window.fbq("track", eventName, params);
}

/** Track a custom Facebook Pixel event */
export function trackFbCustomEvent(eventName: string, params?: Record<string, unknown>) {
  if (!isFbPixelLoaded()) return;
  window.fbq("trackCustom", eventName, params);
}

/** Track a lead capture */
export function trackFbLead(source: string, value = 0) {
  trackFbEvent("Lead", { content_name: source, value, currency: "USD" });
}

/** Track a purchase */
export function trackFbPurchase(value: number, contentName: string) {
  trackFbEvent("Purchase", { value, currency: "USD", content_name: contentName });
}

/** Track checkout initiation */
export function trackFbInitiateCheckout(value: number, contentName: string) {
  trackFbEvent("InitiateCheckout", { value, currency: "USD", content_name: contentName });
}

/** Track page view (already auto-fired by pixel script, use for SPA route changes) */
export function trackFbPageView() {
  trackFbEvent("PageView");
}
