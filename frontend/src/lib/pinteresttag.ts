declare global {
  interface Window {
    pintrk?: (action: string, event: string, params?: Record<string, unknown>) => void;
  }
}

// TODO: Replace PINTEREST_TAG_ID_HERE with the real Pinterest Tag ID.
// Get it from: Pinterest Ads Manager → Conversions → Pinterest Tag → View Tag.
export const PINTEREST_TAG_ID = "PINTEREST_TAG_ID_HERE";

export function trackPinterestPageView() {
  if (typeof window !== "undefined" && window.pintrk) {
    window.pintrk("track", "pagevisit");
  }
}

export function trackPinterestLead(params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.pintrk) {
    window.pintrk("track", "lead", params ?? {});
  }
}

export function trackPinterestSignup(params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.pintrk) {
    window.pintrk("track", "signup", params ?? {});
  }
}

export function trackPinterestCheckout(params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.pintrk) {
    window.pintrk("track", "checkout", params ?? {});
  }
}

export function trackPinterestEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.pintrk) {
    window.pintrk("track", event, params ?? {});
  }
}
