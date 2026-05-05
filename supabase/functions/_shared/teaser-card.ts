// Shared "Angie's List style" teaser card for cold emails.
// Renders a branded preview tile of a single lead/candidate/opportunity so the
// recipient sees concrete value (not just pitch copy) and clicks through.
//
// Usage:
//   import { teaserCardHtml } from "../_shared/teaser-card.ts";
//   const card = teaserCardHtml({
//     headline: "🔥 New Roof Lead — Grosse Pointe, MI",
//     scoreLabel: "Score 9/10 · Hot",
//     bullets: [
//       "Storm hail event 4/29 + new homeowner (sold 3 mo ago)",
//       "Pre-1990 build · est. job value $14,000",
//       "Owner contact unlocked on claim",
//     ],
//     imageUrl: streetViewUrl,      // optional
//     ctaText: "See full lead →",
//     ctaUrl: "https://detroitwebagent.com/start-trial?product=trade_radar_roofing",
//     blurContact: true,            // censor PII for cold recipients
//   });
//
// Inline styles only (most email clients strip <style>). Dark DWA theme.

export interface TeaserCardOpts {
  headline: string;
  scoreLabel?: string;       // e.g. "Score 9/10 · Hot" or "Tier A"
  bullets: string[];         // 2-4 short fact bullets
  imageUrl?: string;         // Street View / hero image
  ctaText: string;
  ctaUrl: string;
  badge?: string;            // tiny label, e.g. "EXCLUSIVE", "FIRST LOOK"
  blurContact?: boolean;     // adds a "Contact info unlocked when you claim" footer
}

const TEAL = "#00d4ff";
const BG = "#0f2540";
const BORDER = "#1e3a5f";
const TEXT = "#e6f1ff";
const MUTED = "#7a8aa0";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

export function teaserCardHtml(opts: TeaserCardOpts): string {
  const badge = opts.badge
    ? `<span style="display:inline-block;background:${TEAL};color:#0a1628;font-size:10px;font-weight:800;letter-spacing:1.5px;padding:3px 8px;border-radius:3px;margin-bottom:8px;">${esc(opts.badge)}</span><br/>`
    : "";

  const score = opts.scoreLabel
    ? `<div style="color:${TEAL};font-size:11px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;margin-bottom:6px;">${esc(opts.scoreLabel)}</div>`
    : "";

  const img = opts.imageUrl
    ? `<img src="${opts.imageUrl}" alt="" width="100%" style="display:block;width:100%;max-height:180px;object-fit:cover;border-radius:6px 6px 0 0;border-bottom:1px solid ${BORDER};" />`
    : "";

  const bullets = opts.bullets
    .filter(Boolean)
    .map(
      (b) =>
        `<li style="margin:0 0 6px;color:${TEXT};font-size:14px;line-height:1.5;">${esc(b)}</li>`
    )
    .join("");

  const blurFooter = opts.blurContact
    ? `<div style="margin-top:12px;padding:8px 10px;background:rgba(0,212,255,0.08);border-radius:4px;color:${MUTED};font-size:11px;line-height:1.4;">
        🔒 Owner name, phone, and email unlock instantly when you claim.
       </div>`
    : "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td>
    <div style="background:${BG};border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
      ${img}
      <div style="padding:18px 20px;">
        ${badge}
        ${score}
        <div style="color:#ffffff;font-size:17px;font-weight:700;line-height:1.3;margin-bottom:12px;">
          ${esc(opts.headline)}
        </div>
        <ul style="margin:0 0 14px;padding-left:18px;">
          ${bullets}
        </ul>
        ${blurFooter}
        <div style="margin-top:16px;">
          <a href="${opts.ctaUrl}" style="background:${TEAL};color:#0a1628;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
            ${esc(opts.ctaText)}
          </a>
        </div>
      </div>
    </div>
  </td></tr>
</table>`;
}
