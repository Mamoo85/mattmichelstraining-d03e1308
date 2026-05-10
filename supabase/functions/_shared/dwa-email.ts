// Shared DWA brand email helper.
// All Detroit Web Agency products (TechAlert, Mortgage Radar, Contractor Leads,
// SiteRadar, FieldDesk, Marketplace, Missed-Call, AI Phone, Bundle Suite, etc.)
// MUST use dwaEmail() — never sendM2Email() — to keep brand isolation between
// M² Training (fitness) and Detroit Web Agency (B2B automation).

import { checkEmailSanity } from "./email-sanity.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://eauvubfpanpeuxsrqesu.supabase.co";

export const DWA_FROM = "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>";
export const DWA_REPLY_TO = "matt@detroitwebagent.com";
export const DWA_TEAL = "#00d4ff";
export const DWA_BG = "#0a1628";
export const DWA_BCC = "matthewmichels4@gmail.com";

export interface DwaEmailOpts {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text fallback (recommended when HTML contains code/script-like content). */
  text?: string;
  bcc?: string;
  /** Override sender display name (for white-label agency digests). */
  fromName?: string;
  /** Override reply-to address (for white-label agency digests). */
  replyTo?: string;
  /** When set, mirrors a successful send onto the HubSpot contact's timeline. */
  hubspotContactId?: string;
  /** Extra headers passed through to Resend (e.g. List-Unsubscribe). */
  headers?: Record<string, string>;
}

export async function dwaEmail(opts: DwaEmailOpts): Promise<{ ok: boolean; error?: string; resendId?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY missing" };
  const fromAddress = "matt@detroitwebagent.com";
  const fromField = opts.fromName
    ? `${opts.fromName} <${fromAddress}>`
    : DWA_FROM;
  const replyToField = opts.replyTo || DWA_REPLY_TO;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromField,
        reply_to: replyToField,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        bcc: [opts.bcc || DWA_BCC],
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `Resend ${r.status}: ${txt}` };
    }
    const body = await r.json().catch(() => ({} as any));
    const resendId: string | undefined = body?.id;
    if (opts.hubspotContactId) {
      // Lazy import to avoid edge-function cold-start cost when HubSpot isn't used
      try {
        const { logEngagement } = await import("./hubspot.ts");
        await logEngagement(opts.hubspotContactId, "EMAIL", opts.html.replace(/<[^>]+>/g, " ").slice(0, 1000), opts.subject);
      } catch (e) {
        console.warn("[dwaEmail→hubspot]", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true, resendId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Products that legitimately offer a free trial. Cold pitches for ANYTHING
 * else (web design, generic agency services, add-ons) MUST NOT advertise a
 * "7-day trial of Detroit Web Agency" — there isn't one. Web design has no
 * trial; we sell builds. Add-ons are sold post-purchase, not cold.
 *
 * Keep this list tight. If you're unsure, don't add it.
 */
export const TRIAL_ELIGIBLE_PRODUCTS = new Set<string>([
  "trade radar", "mortgage radar", "techalert", "hire alert", "talent radar",
  "carealert", "fielddesk", "siteradar", "missed-call catch", "missed call catch",
  "ai phone answering", "bundle revenue suite", "contractor leads",
]);

export function isTrialEligible(product: string): boolean {
  const p = (product || "").toLowerCase();
  for (const slug of TRIAL_ELIGIBLE_PRODUCTS) {
    if (p.includes(slug)) return true;
  }
  return false;
}

/**
 * Plain teal CTA button — used when a cold email is for a non-trial product
 * (web design build, generic outreach). Replaces the old "free 7-day trial"
 * box that was being injected into every send.
 */
export function plainCtaHtml(opts: { url: string; text: string }): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
  <tr><td style="background:${DWA_TEAL};border-radius:8px;">
    <a href="${opts.url}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:${DWA_BG};text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      ${opts.text}&nbsp;→
    </a>
  </td></tr>
</table>`;
}

/**
 * Trial CTA block — only for products in TRIAL_ELIGIBLE_PRODUCTS. Hiring
 * radars (TechAlert/Hire Alert) get 30 days, everything else 7 days.
 */
export function trialCtaHtml(opts: { product: string; url: string }): string {
  const hiring = isHiringProduct(opts.product);
  const days = hiring ? 30 : 7;
  const offerLine = hiring
    ? `Free ${days}-day trial of ${opts.product} — no credit card.`
    : `Free ${days}-day trial — no credit card. <strong style="color:${DWA_TEAL};">Plus 50% off your first 3 months.</strong>`;
  return `
<div style="margin:28px 0;padding:18px 20px;background:rgba(0,212,255,0.08);border:2px solid ${DWA_TEAL};border-radius:10px;text-align:center;">
  <p style="margin:0 0 14px;font-size:15px;color:#e6f1ff;font-weight:600;line-height:1.5;">
    ${offerLine}
  </p>
  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr><td style="background:${DWA_TEAL};border-radius:8px;">
      <a href="${opts.url}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:${DWA_BG};text-decoration:none;">
        Start ${days}-Day Free Trial${hiring ? "" : " + 50% Off"}&nbsp;→
      </a>
    </td></tr>
  </table>
</div>`;
}

export function isHiringProduct(product: string): boolean {
  const p = product.toLowerCase();
  return p.includes("techalert") || p.includes("hire") || p.includes("talent")
      || p.includes("hiring") || p.includes("carealert");
}

/** Build RFC 8058 List-Unsubscribe headers for a cold email recipient. */
export function listUnsubHeaders(recipientEmail: string): Record<string, string> {
  const token = encodeURIComponent(btoa(recipientEmail));
  const unsubUrl = `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
  return {
    "List-Unsubscribe": `<${unsubUrl}>, <mailto:matt@detroitwebagent.com?subject=Unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Canonical cold-email sender. Wraps body in DWA branded shell, gates the
 * trial CTA via TRIAL_ELIGIBLE_PRODUCTS, and logs to email_send_log.
 * Automatically adds List-Unsubscribe headers and runs a pre-send MX/sanity check.
 */
export interface DwaColdEmailOpts {
  to: string;
  subject: string;
  bodyHtml: string;       // inner copy (greeting + pitch). NO CTA — added automatically.
  product: string;        // e.g. "TechAlert", "Mortgage Radar", "Web Design Build"
  ctaUrl: string;         // landing page / trial start URL
  ctaText?: string;       // CTA button label for non-trial products. Default: "See it live →"
  templateName: string;   // for email_send_log audit
  bcc?: string;
  // Visual blocks — render BEFORE the body for max impact (humans are visual).
  teaserHtml?: string;    // pre-rendered teaserCardHtml() output
  previewHtml?: string;   // pre-rendered dashboardPreviewHtml() output
}

export async function dwaColdEmail(
  opts: DwaColdEmailOpts,
  sb?: { from: (t: string) => any },
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  // Pre-send sanity check — skip invalid/disposable/no-MX addresses silently
  const sanity = await checkEmailSanity(opts.to);
  if (!sanity.ok) {
    if (sb) {
      try {
        await sb.from("email_send_log").insert({
          template_name: opts.templateName,
          recipient_email: opts.to,
          status: "skipped",
          error_message: `email_sanity: ${sanity.reason}`,
          metadata: { product: opts.product, cold: true },
        });
      } catch { /* best-effort */ }
    }
    return { ok: false, error: `email_sanity: ${sanity.reason}` };
  }

  const ctaBlock = isTrialEligible(opts.product)
    ? trialCtaHtml({ product: opts.product, url: opts.ctaUrl })
    : plainCtaHtml({ url: opts.ctaUrl, text: opts.ctaText || "See it live →" });
  const visuals = `${opts.previewHtml || ""}${opts.teaserHtml || ""}`;
  const inner = `${visuals}${opts.bodyHtml}\n${ctaBlock}`;
  const html = dwaWrap(inner);
  const messageId = `cold-${opts.templateName}-${crypto.randomUUID()}`;

  if (sb) {
    try {
      await sb.from("email_send_log").insert({
        message_id: messageId,
        template_name: opts.templateName,
        recipient_email: opts.to,
        status: "pending",
        metadata: { product: opts.product, cold: true },
      });
    } catch { /* best-effort */ }
  }

  const r = await dwaEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    bcc: opts.bcc,
    headers: listUnsubHeaders(opts.to),
  });

  if (sb) {
    try {
      await sb.from("email_send_log").insert({
        message_id: messageId,
        template_name: opts.templateName,
        recipient_email: opts.to,
        status: r.ok ? "sent" : "failed",
        error_message: r.error ?? null,
        metadata: {
          product: opts.product,
          cold: true,
          ...(r.resendId ? { resend_email_id: r.resendId } : {}),
        },
      });
    } catch { /* best-effort */ }
  }

  return { ok: r.ok, error: r.error, messageId };
}

/**
 * Wraps inner HTML body in the standard DWA branded shell (teal accents, dark bg).
 */
export function dwaWrap(innerHtml: string, opts?: { ctaText?: string; ctaUrl?: string; preheader?: string; heroBadge?: string }): string {
  const cta = opts?.ctaText && opts?.ctaUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;"><tr><td style="background:${DWA_TEAL};border-radius:8px;"><a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:${DWA_BG};text-decoration:none;">${opts.ctaText}&nbsp;→</a></td></tr></table>`
    : "";
  const preheader = opts?.preheader || "";
  const badge = opts?.heroBadge || "Detroit Web Agency";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#020617;"><tr><td align="center" style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0f1d33;border:1px solid #1e3354;border-radius:12px;overflow:hidden;">
      <tr><td style="background:${DWA_TEAL};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td style="padding:24px 28px 0;">
        <span style="display:inline-block;background:rgba(0,212,255,0.12);color:${DWA_TEAL};font-size:12px;font-weight:700;letter-spacing:1px;padding:5px 12px;border-radius:999px;text-transform:uppercase;">${badge}</span>
      </td></tr>
      <tr><td style="padding:18px 28px 8px;color:#e2e8f0;font-size:16px;line-height:1.6;">
        ${innerHtml}
        ${cta}
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
          <tr>
            <td style="vertical-align:middle;padding-right:12px;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;" alt="Matt Michels"></td>
            <td style="vertical-align:middle;font-size:13px;color:#e2e8f0;line-height:1.5;">
              <strong style="color:#ffffff;">Matt Michels</strong><br>
              <span style="color:#94a3b8;">Detroit Web Agency · Grosse Pointe, MI</span><br>
              <a href="tel:+13139921219" style="color:${DWA_TEAL};text-decoration:none;">(313) 992-1219</a>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:${DWA_BG};padding:14px 28px;border-top:1px solid #1e3354;font-size:11px;color:#94a3b8;line-height:1.5;">
        Detroit Web Agency · Grosse Pointe, MI · (313) 992-1219<br>
        <a href="https://detroitwebagent.com" style="color:#94a3b8;">detroitwebagent.com</a> · <a href="mailto:matt@detroitwebagent.com" style="color:#94a3b8;">matt@detroitwebagent.com</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
