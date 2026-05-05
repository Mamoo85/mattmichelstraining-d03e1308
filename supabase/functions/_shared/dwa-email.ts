// Shared DWA brand email helper.
// All Detroit Web Agency products (TechAlert, Mortgage Radar, Contractor Leads,
// SiteRadar, FieldDesk, Marketplace, Missed-Call, AI Phone, Bundle Suite, etc.)
// MUST use dwaEmail() — never sendM2Email() — to keep brand isolation between
// M² Training (fitness) and Detroit Web Agency (B2B automation).

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

export const DWA_FROM = "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>";
export const DWA_REPLY_TO = "matt@detroitwebagent.com";
export const DWA_TEAL = "#00d4ff";
export const DWA_BG = "#0a1628";
export const DWA_BCC = "matthewmichels4@gmail.com";

export interface DwaEmailOpts {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string;
  /** When set, mirrors a successful send onto the HubSpot contact's timeline. */
  hubspotContactId?: string;
}

export async function dwaEmail(opts: DwaEmailOpts): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: DWA_FROM,
        reply_to: DWA_REPLY_TO,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        bcc: [opts.bcc || DWA_BCC],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `Resend ${r.status}: ${txt}` };
    }
    if (opts.hubspotContactId) {
      // Lazy import to avoid edge-function cold-start cost when HubSpot isn't used
      try {
        const { logEngagement } = await import("./hubspot.ts");
        await logEngagement(opts.hubspotContactId, "EMAIL", opts.html.replace(/<[^>]+>/g, " ").slice(0, 1000), opts.subject);
      } catch (e) {
        console.warn("[dwaEmail→hubspot]", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true };
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
<div style="margin:28px 0;text-align:center;">
  <a href="${opts.url}" style="background:${DWA_TEAL};color:${DWA_BG};padding:13px 26px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;">
    ${opts.text}
  </a>
</div>`;
}

/**
 * Trial CTA block — only for products in TRIAL_ELIGIBLE_PRODUCTS. Hiring
 * radars (TechAlert/Hire Alert) get 30 days, everything else 7 days.
 */
export function trialCtaHtml(opts: { product: string; url: string }): string {
  const hiring = isHiringProduct(opts.product);
  const days = hiring ? 30 : 7;
  const offerLine = hiring
    ? `Start your free ${days}-day trial of ${opts.product} — no credit card required.`
    : `Start your free ${days}-day trial of ${opts.product} — no credit card required. <strong style="color:${DWA_TEAL};">Plus 50% off your first 3 months</strong> when you continue.`;
  return `
<div style="margin:28px 0;padding:20px 22px;background:rgba(0,212,255,0.08);border:1px solid ${DWA_TEAL};border-radius:8px;">
  <p style="margin:0 0 12px;font-size:15px;color:#e6f1ff;font-weight:600;">
    ${offerLine}
  </p>
  <p style="margin:0;">
    <a href="${opts.url}" style="background:${DWA_TEAL};color:${DWA_BG};padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">
      Start Free ${days}-Day Trial${hiring ? "" : " + 50% Off"}
    </a>
  </p>
</div>`;
}

export function isHiringProduct(product: string): boolean {
  const p = product.toLowerCase();
  return p.includes("techalert") || p.includes("hire") || p.includes("talent")
      || p.includes("hiring") || p.includes("carealert");
}

/**
 * Canonical cold-email sender. Wraps body in DWA branded shell, auto-injects
 * the correct trial CTA (7 or 30 days), and logs to email_send_log.
 */
export interface DwaColdEmailOpts {
  to: string;
  subject: string;
  bodyHtml: string;       // inner copy (greeting + pitch). NO trial CTA — added automatically.
  product: string;        // e.g. "TechAlert", "Mortgage Radar", "Contractor Leads"
  ctaUrl: string;         // landing page / trial start URL
  templateName: string;   // for email_send_log audit
  bcc?: string;
}

export async function dwaColdEmail(
  opts: DwaColdEmailOpts,
  sb?: { from: (t: string) => any },
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const inner = `${opts.bodyHtml}\n${trialCtaHtml({ product: opts.product, url: opts.ctaUrl })}`;
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

  const r = await dwaEmail({ to: opts.to, subject: opts.subject, html, bcc: opts.bcc });

  if (sb) {
    try {
      await sb.from("email_send_log").insert({
        message_id: messageId,
        template_name: opts.templateName,
        recipient_email: opts.to,
        status: r.ok ? "sent" : "failed",
        error_message: r.error ?? null,
        metadata: { product: opts.product, cold: true },
      });
    } catch { /* best-effort */ }
  }

  return { ...r, messageId };
}

/**
 * Wraps inner HTML body in the standard DWA branded shell (teal accents, dark bg).
 */
export function dwaWrap(innerHtml: string, opts?: { ctaText?: string; ctaUrl?: string }): string {
  const cta = opts?.ctaText && opts?.ctaUrl
    ? `<p style="margin:28px 0 8px;"><a href="${opts.ctaUrl}" style="background:${DWA_TEAL};color:${DWA_BG};padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;">${opts.ctaText}</a></p>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:${DWA_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;color:#e6f1ff;">
    <div style="margin-bottom:24px;">
      <span style="color:${DWA_TEAL};font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;">Detroit Web Agency</span>
    </div>
    ${innerHtml}
    ${cta}
    <hr style="border:0;border-top:1px solid #1e3a5f;margin:32px 0 16px;" />
    <p style="font-size:11px;color:#7a8aa0;line-height:1.5;margin:0;">
      Detroit Web Agency · Grosse Pointe, MI · (313) 992-1219<br/>
      <a href="https://detroitwebagent.com" style="color:#7a8aa0;">detroitwebagent.com</a> · <a href="mailto:matt@detroitwebagent.com" style="color:#7a8aa0;">matt@detroitwebagent.com</a>
    </p>
  </div>
</body></html>`;
}
