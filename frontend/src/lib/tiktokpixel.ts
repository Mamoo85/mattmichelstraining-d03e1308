declare global {
  interface Window {
    ttq?: {
      page: () => void;
      track: (event: string, params?: Record<string, unknown>) => void;
      load: (pixelId: string) => void;
      identify: (params: Record<string, unknown>) => void;
    };
  }
}

// TODO: Replace TIKTOK_PIXEL_ID_HERE with the real TikTok Pixel ID.
// Get it from: TikTok Ads Manager → Assets → Events → Web Events → Manage → your pixel.
export const TIKTOK_PIXEL_ID = "TIKTOK_PIXEL_ID_HERE";

export function trackTikTokPageView() {
  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.page();
  }
}

export function trackTikTokLead(params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.track("SubmitForm", params);
  }
}

export function trackTikTokSignup(params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.track("CompleteRegistration", params);
  }
}

export function trackTikTokEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.ttq) {
    window.ttq.track(event, params);
  }
}

export function identifyTikTokUser(email?: string, phone?: string) {
  if (typeof window !== "undefined" && window.ttq && (email || phone)) {
    window.ttq.identify({ email: email ?? "", phone_number: phone ?? "" });
  }
}
