// Centralized URL + QR builder for the trial CTA.
// Every email/fax/postcard/SMS/ad must build CTAs through here so one
// change to /start-trial or UTM scheme propagates everywhere.

import { OFFERS, type ProductKey, offerCopy } from "./offers.ts";

const PUBLIC_BASE = Deno.env.get("DWA_PUBLIC_URL") || "https://detroitwebagent.com";

export interface OfferUrlOpts {
  channel: "email" | "fax" | "postcard" | "sms" | "ad_meta" | "ad_google" | "qr";
  campaign?: string;
  variant?: string;
  recipientId?: string; // hashed/contact id, NOT raw PII
  /** Pre-fill the trial form's email field. Only set for 1:1 outbound (cold email/drip). */
  email?: string;
  /** Pre-fill business name. */
  business?: string;
  /** Resume token for abandoned-trial drip. */
  resume?: string;
}

export function buildOfferUrl(productKey: ProductKey, opts: OfferUrlOpts): string {
  const url = new URL("/start-trial", PUBLIC_BASE);
  url.searchParams.set("product", productKey);
  url.searchParams.set("utm_source", opts.channel);
  url.searchParams.set("utm_medium", opts.channel === "ad_meta" || opts.channel === "ad_google" ? "paid" : "outbound");
  if (opts.campaign) url.searchParams.set("utm_campaign", opts.campaign);
  if (opts.variant) url.searchParams.set("utm_content", opts.variant);
  if (opts.recipientId) url.searchParams.set("rcpt", opts.recipientId);
  if (opts.email) url.searchParams.set("email", opts.email.trim().toLowerCase());
  if (opts.business) url.searchParams.set("business", opts.business);
  if (opts.resume) url.searchParams.set("resume", opts.resume);
  return url.toString();
}

/**
 * QR PNG via Google Chart API (deprecated but still works) with QRServer fallback.
 * Encodes the same /start-trial URL so printed and digital assets are identical.
 */
export function buildQrPngUrl(productKey: ProductKey, opts: OfferUrlOpts, sizePx = 300): string {
  const target = buildOfferUrl(productKey, { ...opts, channel: "qr" });
  return `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&data=${encodeURIComponent(target)}`;
}

/** Convenience: build CTA + headline/short pitch in one call. */
export function buildCta(productKey: ProductKey, opts: OfferUrlOpts) {
  const copy = offerCopy(productKey);
  return {
    ...copy,
    url: buildOfferUrl(productKey, opts),
    qrUrl: buildQrPngUrl(productKey, opts),
    productName: OFFERS[productKey].displayName,
  };
}
