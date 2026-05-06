// Shared premium email shell for all Detroit Web Agency outbound emails.
// Matches the approved healthcare-style design: dark hero, teal accents,
// short paragraphs, optional add-on box, single pill CTA, signature.
//
// Every cold/drip/transactional email to prospects or clients should render
// through buildPremiumEmailHtml() to stay on-brand and avoid copy/HTML drift.

export const DWA_TEAL = "#00d4ff";
export const DWA_BG = "#0a1628";
export const DWA_DARK_PANEL = "#0f1d33";
export const DWA_BORDER = "#1e3354";
export const DWA_TEXT = "#e2e8f0";
export const DWA_MUTED = "#94a3b8";

export interface PremiumEmailAddOn {
  icon?: string; // emoji
  label: string;
}

export interface PremiumEmailOpts {
  /** Inbox preview line (hidden but shown by Gmail/Apple Mail under subject) */
  preheader: string;
  /** Small teal pill above the headline e.g. "DETROIT WEB AGENCY" */
  heroBadge: string;
  /** 24px bold headline */
  headline: string;
  /** Each entry becomes its own <p>. Keep to 1-2 sentences each. */
  paragraphs: string[];
  /** Optional metric panel (e.g. "$47k/year missed revenue") */
  statCard?: { value: string; label: string };
  /** Optional teal-bordered add-on box (used on web-design + radar pitches) */
  addOnBox?: { title: string; items: PremiumEmailAddOn[] };
  /** Optional inline image URL above add-on box (e.g. demo screenshot) */
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** CTA button — URL must come from buildOfferUrl() or a vetted landing page */
  ctaUrl: string;
  ctaText: string;
  /** Optional signoff line above signature (e.g. "Matt, (313) 992-1219") */
  signoffLine?: string;
  /** Optional small footer note above unsubscribe (legal/PS line) */
  footerNote?: string;
  /** Optional unsubscribe URL — when omitted, generic unsubscribe text is shown */
  unsubscribeUrl?: string;
}

const SIGNATURE_HTML = `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
  <tr>
    <td style="vertical-align:middle;padding-right:12px;">
      <img src="https://www.detroitwebagent.com/images/matt-boat.jpg"
           width="48" height="48"
           style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;"
           alt="Matt Michels">
    </td>
    <td style="vertical-align:middle;font-size:13px;color:${DWA_TEXT};line-height:1.5;">
      <strong style="color:#ffffff;">Matt Michels</strong><br>
      <span style="color:${DWA_MUTED};">Detroit Web Agency · Grosse Pointe, MI</span><br>
      <a href="tel:+13139921219" style="color:${DWA_TEAL};text-decoration:none;">(313) 992-1219</a>
    </td>
  </tr>
</table>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPremiumEmailHtml(opts: PremiumEmailOpts): string {
  const paragraphsHtml = opts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${DWA_TEXT};">${p}</p>`,
    )
    .join("");

  const statCardHtml = opts.statCard
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
         <tr><td style="background:${DWA_BG};border:1px solid ${DWA_BORDER};border-radius:8px;padding:16px 20px;">
           <div style="font-size:28px;font-weight:800;color:${DWA_TEAL};line-height:1.1;">${escapeHtml(opts.statCard.value)}</div>
           <div style="font-size:13px;color:${DWA_MUTED};margin-top:4px;">${escapeHtml(opts.statCard.label)}</div>
         </td></tr>
       </table>`
    : "";

  const heroImgHtml = opts.heroImageUrl
    ? `<div style="margin:20px 0;text-align:center;">
         <img src="${opts.heroImageUrl}" alt="${escapeHtml(opts.heroImageAlt || "")}"
              style="max-width:100%;border-radius:8px;border:1px solid ${DWA_BORDER};display:block;margin:0 auto;">
       </div>`
    : "";

  const addOnHtml = opts.addOnBox
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
         <tr><td style="background:${DWA_BG};border:2px solid ${DWA_TEAL};border-radius:8px;padding:18px 20px;">
           <div style="font-size:13px;font-weight:700;color:${DWA_TEAL};letter-spacing:0.5px;text-transform:uppercase;margin-bottom:10px;">${escapeHtml(opts.addOnBox.title)}</div>
           ${opts.addOnBox.items
             .map(
               (i) =>
                 `<div style="font-size:15px;color:${DWA_TEXT};line-height:1.6;margin-bottom:6px;">${i.icon ? `${i.icon} ` : "✓ "}${escapeHtml(i.label)}</div>`,
             )
             .join("")}
         </td></tr>
       </table>`
    : "";

  const ctaHtml = `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
      <tr><td style="background:${DWA_TEAL};border-radius:8px;">
        <a href="${opts.ctaUrl}"
           style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:${DWA_BG};text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          ${escapeHtml(opts.ctaText)}&nbsp;→
        </a>
      </td></tr>
    </table>`;

  const signoffHtml = opts.signoffLine
    ? `<p style="margin:24px 0 0;font-size:15px;color:${DWA_TEXT};">${escapeHtml(opts.signoffLine)}</p>`
    : "";

  const footerNoteHtml = opts.footerNote
    ? `<p style="font-size:12px;color:${DWA_MUTED};margin:20px 0 0;line-height:1.5;font-style:italic;">${opts.footerNote}</p>`
    : "";

  const unsubHtml = opts.unsubscribeUrl
    ? `<a href="${opts.unsubscribeUrl}" style="color:${DWA_MUTED};text-decoration:underline;">Unsubscribe</a>`
    : `Reply STOP to unsubscribe`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.heroBadge)}</title>
</head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(opts.preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#020617;">
<tr><td align="center" style="padding:24px 12px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${DWA_DARK_PANEL};border:1px solid ${DWA_BORDER};border-radius:12px;overflow:hidden;">
    <tr><td style="background:${DWA_TEAL};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 28px 8px;">
      <span style="display:inline-block;background:rgba(0,212,255,0.12);color:${DWA_TEAL};font-size:12px;font-weight:700;letter-spacing:1px;padding:5px 12px;border-radius:999px;text-transform:uppercase;">${escapeHtml(opts.heroBadge)}</span>
    </td></tr>
    <tr><td style="padding:14px 28px 0;">
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;">${opts.headline}</h1>
      ${paragraphsHtml}
      ${statCardHtml}
      ${heroImgHtml}
      ${addOnHtml}
      <div style="text-align:center;">${ctaHtml}</div>
      ${signoffHtml}
      ${SIGNATURE_HTML}
      ${footerNoteHtml}
    </td></tr>
    <tr><td style="background:${DWA_BG};padding:16px 28px;border-top:1px solid ${DWA_BORDER};font-size:11px;color:${DWA_MUTED};line-height:1.5;">
      Detroit Web Agency · Grosse Pointe, MI · (313) 992-1219<br>
      <a href="https://detroitwebagent.com" style="color:${DWA_MUTED};">detroitwebagent.com</a> · ${unsubHtml}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

/** Common add-on box used on every web-design pitch: stress the ecosystem. */
export const WEB_DESIGN_ADDON_BOX = {
  title: "Every site includes — free",
  items: [
    { icon: "📱", label: "Review Texts — auto-ask happy patients for Google reviews" },
    { icon: "💳", label: "Pay-Me Texts — text invoices and get paid in 60 seconds" },
    { icon: "📅", label: "Appointment Reminder Texts — cut no-shows in half" },
    { icon: "👀", label: "SiteRadar — see every company that visits your site" },
  ],
} as const;

/** Add-on box for any Radar product pitch. */
export const RADAR_ADDON_BOX = {
  title: "Plus — included with every Radar",
  items: [
    { icon: "📲", label: "Daily AM SMS digest — hot leads delivered before coffee" },
    { icon: "📧", label: "Morning email brief — full lead detail + Street View" },
    { icon: "📊", label: "90-day signal history + CSV export" },
  ],
} as const;
