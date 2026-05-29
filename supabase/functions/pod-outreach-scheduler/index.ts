// pod-outreach-scheduler — daily B2B cold email outreach with trauma audit personalization
// Cron: 0 8 * * 1-5 (weekdays 8am UTC — max 20 sends/day)
//
// Flow:
//   1. Pull b2b_audit_queue rows with audit_status='audited' (have generated audit text)
//   2. For each: compose personalized plain-text cold email embedding the audit paragraph
//   3. Send via dwaColdEmail() with plainMode=true for maximum deliverability
//   4. Mark sent / log to email_send_log (via dwaColdEmail)
//
// For businesses without pre-generated audits:
//   Calls generate-trauma-audit inline (fetch + audit) then sends immediately.
//   Used when prospect-local-businesses feeds fresh leads directly.
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { inspectHomepage, formatTraumaForPrompt } from "../_shared/homepage-inspector.ts";
import { generateText } from "../_shared/ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[OUTREACH-SCHEDULER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

const DAILY_SEND_CAP = 20;

function extractFirstName(businessName: string): string {
  // Best effort: if it's a person's name ("John Smith HVAC"), extract first name.
  // Otherwise return "there" for generic greeting.
  const words = businessName.trim().split(/\s+/);
  const first = words[0];
  // If it looks like a real name (no special chars, normal length), use it
  if (first && /^[A-Z][a-z]{2,}$/.test(first)) return first;
  return "there";
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function buildAuditEmail(opts: {
  businessName: string;
  websiteUrl: string;
  industry: string;
  city: string;
  auditText: string;
}): string {
  const firstName = extractFirstName(opts.businessName);
  const domain = extractDomain(opts.websiteUrl);

  // Plain HTML email that reads like a personal Gmail message
  return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#1a1a1a;max-width:560px;">
<p>Hi ${firstName},</p>

<p>I ran a quick technical review of <strong>${domain}</strong> this morning.</p>

<p style="white-space:pre-line;">${opts.auditText}</p>

<p>I help ${opts.industry} businesses in ${opts.city} fix exactly these issues — typically in 48 hours, no long contracts, no retainers. I can send you a live mockup of what ${opts.businessName}'s site looks like after the rebuild if you're curious.</p>

<p>Worth a quick look?</p>

<p>— Matt Michels<br>
Detroit Web Agency · Grosse Pointe, MI<br>
<a href="tel:+13139921219" style="color:#1a1a1a;">(313) 992-1219</a><br>
<a href="https://detroitwebagent.com" style="color:#1a1a1a;">detroitwebagent.com</a></p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── 1. Load audited rows ready to send ────────────────────────────────────
  const { data: rows } = await sb
    .from("b2b_audit_queue")
    .select("*")
    .eq("audit_status", "audited")
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(DAILY_SEND_CAP);

  log("Rows to send", { count: rows?.length ?? 0 });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (rows ?? [])) {
    if (sent >= DAILY_SEND_CAP) break;

    // Check email_send_log for dedup — don't resend to same email
    const { count: priorSends } = await sb
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient_email", row.email)
      .like("template_name", "trauma_audit%");

    if ((priorSends ?? 0) > 0) {
      log("Skipping — already sent audit to this email", { email: row.email });
      await sb.from("b2b_audit_queue").update({ audit_status: "sent" }).eq("id", row.id);
      skipped++;
      continue;
    }

    const subject = `Quick look at ${extractDomain(row.website_url)} — ${row.city ?? ""} ${row.industry ?? ""}`.trim().replace(/\s+/g, " ");
    const bodyHtml = buildAuditEmail({
      businessName: row.business_name,
      websiteUrl:   row.website_url,
      industry:     row.industry ?? "local business",
      city:         row.city ?? "your area",
      auditText:    row.audit_text,
    });

    const result = await dwaColdEmail({
      to:           row.email,
      subject,
      bodyHtml,
      product:      "Web Design Build",
      ctaUrl:       "https://detroitwebagent.com/contact",
      ctaText:      "See a Free Mockup →",
      templateName: `trauma_audit_${row.id}`,
      plainMode:    true,   // no dark branded wrapper — reads like personal Gmail
    }, sb as any);

    if (result.ok) {
      sent++;
      await sb.from("b2b_audit_queue").update({
        audit_status: "sent",
        sent_at: new Date().toISOString(),
      }).eq("id", row.id);
      log("Sent", { to: row.email, business: row.business_name.slice(0, 40), messageId: result.messageId });
    } else {
      failed++;
      log("Send failed", { to: row.email, error: result.error?.slice(0, 80) });
    }

    // Pause 3 seconds between sends — respects Resend rate limits
    await new Promise(r => setTimeout(r, 3_000));
  }

  // ── 2. Inline generation for fresh leads (no audit yet) ───────────────────
  // If triggered with a body payload containing business data, generate + send immediately.
  // This allows prospect-local-businesses to call us directly after scraping.
  let body: {
    generateAndSend?: Array<{
      businessName: string; websiteUrl: string; industry: string; city: string; email: string; phone?: string;
    }>;
  } = {};
  try { body = await req.clone().json().catch(() => ({})); } catch { /* no body */ }

  const inlineLeads = body.generateAndSend ?? [];
  let inlineSent = 0;

  for (const lead of inlineLeads) {
    if (sent + inlineSent >= DAILY_SEND_CAP) break;
    if (!lead.email || !lead.websiteUrl) continue;

    try {
      // 1. Inspect homepage
      const traumaPoints = await inspectHomepage(lead.websiteUrl);
      if (!traumaPoints || traumaPoints.trauma_count === 0) {
        log("No trauma found — skipping", { url: lead.websiteUrl.slice(0, 60) });
        continue;
      }

      const issuesList = formatTraumaForPrompt(traumaPoints);

      // 2. Generate audit
      const auditText = await generateText(`You are a no-fluff website revenue diagnostician for a web design agency.
Write a 200-250 word "Revenue Leak Report" that reads like a human expert reviewed the site manually.
STRICT RULES: Name specific issues as revenue leaks with dollar impact framing. Use the business name "${lead.businessName}", industry "${lead.industry}", and city "${lead.city}" in your observations. Second person, active voice, punchy sentences. No headers, no bullet points — flowing paragraphs only. Final sentence: "Every day ${lead.businessName} runs without fixing this, a competing ${lead.industry} in ${lead.city} is capturing those calls instead."
Business: ${lead.businessName}. Issues Found:\n${issuesList}`, 400);

      if (!auditText) continue;

      // 3. Store
      const { data: queueRow } = await sb.from("b2b_audit_queue").insert({
        business_name: lead.businessName,
        website_url: lead.websiteUrl,
        email: lead.email,
        phone: lead.phone ?? null,
        industry: lead.industry,
        city: lead.city,
        trauma_points: traumaPoints,
        audit_text: auditText,
        audit_status: "audited",
      }).select("id").single();

      // 4. Send
      const subject = `Quick look at ${extractDomain(lead.websiteUrl)} — ${lead.city} ${lead.industry}`.replace(/\s+/g, " ");
      const bodyHtml = buildAuditEmail({ businessName: lead.businessName, websiteUrl: lead.websiteUrl, industry: lead.industry, city: lead.city, auditText });

      const result = await dwaColdEmail({
        to: lead.email, subject, bodyHtml, product: "Web Design Build",
        ctaUrl: "https://detroitwebagent.com/contact", ctaText: "See a Free Mockup →",
        templateName: `trauma_audit_inline_${queueRow?.id ?? Date.now()}`,
        plainMode: true,
      }, sb as any);

      if (result.ok) {
        inlineSent++;
        await sb.from("b2b_audit_queue").update({ audit_status: "sent", sent_at: new Date().toISOString() }).eq("id", queueRow?.id);
        log("Inline send complete", { to: lead.email, trauma: traumaPoints.trauma_count });
      }

      await new Promise(r => setTimeout(r, 3_000));
    } catch (e) {
      log("Inline lead error (non-fatal)", { error: (e as Error).message.slice(0, 80) });
    }
  }

  return new Response(
    JSON.stringify({ success: true, sent, inlineSent, skipped, failed }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
