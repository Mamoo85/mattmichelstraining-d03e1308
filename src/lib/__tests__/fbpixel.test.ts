import { describe, it, expect, vi, beforeEach } from "vitest";
import { isFbPixelLoaded, trackFbEvent, trackFbCustomEvent, trackFbLead, trackFbPurchase, trackFbInitiateCheckout, trackFbPageView } from "../fbpixel";

describe("Facebook Pixel utilities", () => {
  beforeEach(() => {
    // Reset fbq mock before each test
    (window as any).fbq = undefined;
  });

  it("isFbPixelLoaded returns false when fbq is not defined", () => {
    expect(isFbPixelLoaded()).toBe(false);
  });

  it("isFbPixelLoaded returns true when fbq is a function", () => {
    (window as any).fbq = vi.fn();
    expect(isFbPixelLoaded()).toBe(true);
  });

  it("trackFbEvent does nothing when fbq is not loaded", () => {
    // Should not throw
    trackFbEvent("Lead", { value: 10 });
  });

  it("trackFbEvent calls fbq with correct args", () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;
    trackFbEvent("Lead", { value: 10, currency: "USD" });
    expect(mockFbq).toHaveBeenCalledWith("track", "Lead", { value: 10, currency: "USD" });
  });

  it("trackFbCustomEvent calls fbq with trackCustom", () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;
    trackFbCustomEvent("SignupComplete", { source: "landing" });
    expect(mockFbq).toHaveBeenCalledWith("trackCustom", "SignupComplete", { source: "landing" });
  });

  it("trackFbLead sends Lead event with source", () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;
    trackFbLead("website_audit", 29);
    expect(mockFbq).toHaveBeenCalledWith("track", "Lead", { content_name: "website_audit", value: 29, currency: "USD" });
  });

  it("trackFbPurchase sends Purchase event", () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;
    trackFbPurchase(49, "competitor_report");
    expect(mockFbq).toHaveBeenCalledWith("track", "Purchase", { value: 49, currency: "USD", content_name: "competitor_report" });
  });

  it("trackFbInitiateCheckout sends InitiateCheckout event", () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;
    trackFbInitiateCheckout(19, "gbp_posts");
    expect(mockFbq).toHaveBeenCalledWith("track", "InitiateCheckout", { value: 19, currency: "USD", content_name: "gbp_posts" });
  });

  it("trackFbPageView sends PageView event", () => {
    const mockFbq = vi.fn();
    (window as any).fbq = mockFbq;
    trackFbPageView();
    expect(mockFbq).toHaveBeenCalledWith("track", "PageView", undefined);
  });
});
