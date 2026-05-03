// Shared snippet used by ad_launch_drafts AI prompts so Meta/Google ad copy
// always reflects the canonical offer. Drop into any Opus/Haiku prompt.

import { OFFERS, TRIAL_DAYS, INTRO_DISCOUNT_PCT, INTRO_DISCOUNT_MONTHS, type ProductKey, offerCopy } from "./offers.ts";
import { buildOfferUrl } from "./offer-url.ts";

export function offerPromptBlock(productKey: ProductKey, campaign?: string): string {
  const offer = OFFERS[productKey];
  const copy = offerCopy(productKey);
  const url = buildOfferUrl(productKey, { channel: "ad_meta", campaign });
  const lines = [
    `PRODUCT: ${offer.displayName}`,
    `MONTHLY PRICE: $${(offer.monthlyPriceCents / 100).toFixed(0)}/mo`,
  ];
  if (offer.trialEligible) {
    lines.push(`OFFER: ${TRIAL_DAYS}-day free trial, NO credit card required`);
    if (offer.introDiscountEligible) {
      lines.push(`POST-TRIAL: ${INTRO_DISCOUNT_PCT}% off the first ${INTRO_DISCOUNT_MONTHS} months`);
    }
  } else if (productKey === "dead_lead") {
    lines.push("OFFER: First positive reply is FREE; $50 per positive reply after that");
  }
  lines.push(`HEADLINE HINT: ${copy.headline}`);
  lines.push(`PITCH HINT: ${copy.shortPitch}`);
  lines.push(`CTA URL (use exactly): ${url}`);
  lines.push("");
  lines.push("RULES: Do NOT invent prices, trial lengths, or discount %.");
  lines.push("       Only use the values listed above. CTA must link to the URL above.");
  return lines.join("\n");
}
