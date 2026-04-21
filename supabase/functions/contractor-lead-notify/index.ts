// Cron-triggered function: checks for unnotified leads every 15 minutes.
// Subscription contractors: full contact info via SMS + email immediately.
// PPL contractors (no active subscription): FOMO teaser SMS with $50 claim link.
// Also releases expired soft locks so leads become available again.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";
import { generateWithHaiku } from "../_shared/opus.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const SITE_URL = "https://www.detroitwebagent.com";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Item 43: Hunter email validation
async function validateEmail(email: string): Promise<boolean> {
  if (!HUNTER_API_KEY || !email) return true;
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return true;
    const data = await res.json();
    return data?.data?.status !== "invalid";
  } catch { return true; }
}

// Item 44: PDL person enrichment on homeowner phone
async function pdlEnrichPhone(phone: string): Promise<string> {
  if (!PDL_API_KEY || !phone) return "";
  try {
    const clean = phone.replace(/\D/g, "");
    const res = await fetch(
      `https://api.peopledatalabs.com/v5/person/enrich?phone=%2B1${clean.slice(-10)}&min_likelihood=4&pretty=false`,
      { headers: { "X-Api-Key": PDL_API_KEY }, signal: AbortSignal.timeout(7000) }
    );
    if (res.status === 404 || !res.ok) return "";
    const data = await res.json();
    const name = data?.person?.full_name || "";
    const job = data?.person?.job_title || "";
    if (!name) return "";
    return job ? `${name} (${job})` : name;
  } catch { return ""; }
}

// Item 48: HIBP domain breach check for contractor
async function checkDomainBreach(email: string): Promise<boolean> {
  if (!HIBP_API_KEY || !email || !email.includes("@")) return false;
  const domain = email.split("@")[1];
  try {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`,
      { headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "DetroitWebAgency" }, signal: AbortSignal.timeout(6000) }
    );
    if (res.status === 404) return false;
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

// Item 36: Twilio carrier lookup for lead phone
async function leadCarrierType(phone: string): Promise<string> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !phone) return "unknown";
  try {
    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`,
      {
        headers: { Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return "unknown";
    const data = await res.json();
    return data?.line_type_intelligence?.type || "unknown";
  } catch { return "unknown"; }
}

// Item 40: Recent permit surge signals for city
async function queryPermitContext(sb: any, city: string): Promise<string> {
  try {
    const { data } = await sb
      .from("industry_pulse_signals")
      .select("company_name, hiring_count")
      .eq("signal_type", "permit_surge")
      .ilike("location", `%${city}%`)
      .gte("detected_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(3);
    if (!data?.length) return "";
    return `${data.length} active contractor(s) pulling permits in ${city}: ${data.map((d: any) => d.company_name).join(", ")}`;
  } catch { return ""; }
}

/**
 * AI-generated one-liner for SMS/email subject. Cached on contractor_leads.ai_summary.
 * Falls back to "" so existing static copy still ships if AI fails.
 * Format target: "Apex Signal: $40k+ Kitchen Remodel in Grosse Pointe."
 */
async function buildAiSummary(lead: any, site: any): Promise<string> {
  const trade = site?.trade || "service";
  const city = site?.city || "Metro Detroit";
  const project = lead.project_type || trade;
  const msg = (lead.message || "").slice(0, 280);
  const prompt = `You write one-line lead alerts for trade contractors. Tone: confident, specific, scarce — never hypey, never use the word "AI".

Lead details:
- Trade: ${trade}
- City: ${city}
- Project: ${project}
- Homeowner message: "${msg || "no message provided"}"

Write ONE sentence (max 18 words) that quantifies likely project value if obvious from the message and creates urgency. Format exactly: "Apex Signal: <value-or-quality bracket> <project> in <city>."

Examples:
- "Apex Signal: New $40k+ Kitchen Remodel request in Grosse Pointe."
- "Apex Signal: Same-day emergency boiler replacement in Livonia."
- "Apex Signal: Detached garage rewire (200A panel) in Royal Oak."

Output ONLY the sentence. No quotes, no preamble, no commentary.`;
  try {
    const out = await generateWithHaiku(prompt, undefined, 80);
    const cleaned = (out || "").replace(/^["']|["']$/g, "").split("\n")[0].trim();
    if (cleaned.length < 10 || cleaned.length > 200) return "";
    return cleaned;
  } catch { return ""; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: require service-role key (cron) — prevents external invocation that would
  // trigger duplicate Twilio sends and reveal credential metadata.
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${SUPABASE_SERVICE_KEY}`;
  if (!SUPABASE_SERVICE_KEY || authHeader !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Release expired soft locks so leads become available again
    await sb.from("contractor_leads")
      .update({ status: "new", checkout_locked_by: null, lock_expires_at: null })
      .eq("status", "pending_checkout")
      .lt("lock_expires_at", new Date().toISOString());

    // Find leads created in last 24h that haven't been notified
    const { data: unnotified } = await sb
      .from("contractor_leads")
      .select("id, name, phone, email, message, project_type, contact_preference, created_at, site_id")
      .eq("status", "new")
      .is("notified_at", null)
      .not("site_id", "is", null)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!unnotified || unnotified.length === 0) {
      console.log("[LEAD-NOTIFY] No unnotified leads with site_id found");
      return new Response(JSON.stringify({ notified: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[LEAD-NOTIFY] Found ${unnotified.length} unnotified leads`);

    let count = 0;
    for (const lead of unnotified) {
      // Fetch site separately — nested joins don't resolve reliably
      const { data: site } = await sb
        .from("contractor_lead_sites")
        .select("id, trade, city, state, slug, active_contractor_id")
        .eq("id", lead.site_id)
        .maybeSingle();

      if (!site?.active_contractor_id) {
        console.log(`[LEAD-NOTIFY] No active contractor for site ${lead.site_id} on lead ${lead.id}, skipping`);
        continue;
      }

      const { data: contractor } = await sb
        .from("contractor_clients")
        .select("id, name, business_name, email, phone, active")
        .eq("id", site.active_contractor_id)
        .maybeSingle();

      if (!contractor) {
        console.log(`[LEAD-NOTIFY] Contractor ${site.active_contractor_id} not found for lead ${lead.id}, skipping`);
        continue;
      }

      const isActiveSubscriber = contractor.active === true;

      if (isActiveSubscriber) {
        // Items 36,40,43,44,48: parallel lead enrichment
        const [emailValid, pdlVerified, domainBreached, carrierType, permitCtx] = await Promise.all([
          validateEmail(contractor.email),
          pdlEnrichPhone(lead.phone),
          checkDomainBreach(contractor.email),
          leadCarrierType(lead.phone),
          queryPermitContext(sb, site?.city || "Detroit"),
        ]);
        const breachWarn = domainBreached ? "🔒 BREACH: contractor domain. " : "";

        // ── SUBSCRIPTION CONTRACTOR: full contact info ──────────────────────
        if (emailValid && contractor.email && RESEND_API_KEY) {
          const tradeLabel = site?.trade || "service";
          const firstName = lead.name?.split(" ")[0]?.toUpperCase() || "THEM";

          // AI summary (cached) — use as subject + SMS first line if available
          let aiSummary: string = (lead as any).ai_summary || "";
          if (!aiSummary) {
            aiSummary = await buildAiSummary(lead, site);
            if (aiSummary) {
              await sb.from("contractor_leads").update({ ai_summary: aiSummary }).eq("id", lead.id);
            }
          }

          const messageBlock = lead.message
            ? `<div style="background:#0d1f3c;border-left:3px solid #00d4ff;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px">
                <p style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:2px;margin:0 0 8px;text-transform:uppercase">Message from homeowner</p>
                <p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.6;font-style:italic">"${lead.message}"</p>
               </div>`
            : "";
          const leadHtml = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:580px;margin:0 auto;background:#0a1628">
  <div style="padding:22px 32px 16px;border-bottom:2px solid #00d4ff;text-align:center">
    <div style="color:#ffffff;font-size:17px;font-weight:900;letter-spacing:2px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:9px;letter-spacing:4px;margin-top:4px;font-weight:600">EXCLUSIVE LEAD NOTIFICATION</div>
  </div>
  <div style="background:#00d4ff;padding:14px 32px;text-align:center">
    <p style="margin:0;color:#0a1628;font-size:17px;font-weight:900;letter-spacing:0.5px">🔥 NEW ${tradeLabel.toUpperCase()} LEAD — EXCLUSIVE TO YOU</p>
  </div>
  ${aiSummary ? `<div style="background:#0d1f3c;padding:14px 32px;text-align:center;border-bottom:1px solid #1e3a5f"><p style="margin:0;color:#00d4ff;font-size:14px;font-weight:700;letter-spacing:0.3px">${aiSummary}</p></div>` : ""}
  <div style="padding:28px 32px">
    <p style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:3px;margin:0 0 16px;text-transform:uppercase">Lead Details</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #1e3a5f;color:#64748b;font-size:13px;width:90px">Name</td><td style="padding:10px 0;border-bottom:1px solid #1e3a5f;color:#ffffff;font-weight:700;font-size:16px">${lead.name}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #1e3a5f;color:#64748b;font-size:13px">Phone</td><td style="padding:10px 0;border-bottom:1px solid #1e3a5f"><a href="tel:${lead.phone}" style="color:#00d4ff;font-weight:700;font-size:16px;text-decoration:none">${lead.phone}</a></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #1e3a5f;color:#64748b;font-size:13px">Email</td><td style="padding:10px 0;border-bottom:1px solid #1e3a5f;color:#e2e8f0;font-size:14px">${lead.email || "—"}</td></tr>
      <tr><td style="padding:10px 0;color:#64748b;font-size:13px">Project</td><td style="padding:10px 0;color:#e2e8f0;font-size:14px">${lead.project_type || "—"}</td></tr>
      ${carrierType !== "unknown" ? `<tr><td style="padding:8px 0;color:#64748b;font-size:12px">Phone</td><td style="padding:8px 0;color:#94a3b8;font-size:13px">${carrierType}${carrierType === "landline" ? " ⚠️ DNC-risk" : ""}</td></tr>` : ""}
      ${pdlVerified ? `<tr><td style="padding:8px 0;color:#64748b;font-size:12px">PDL</td><td style="padding:8px 0;color:#22c55e;font-size:13px">✓ ${pdlVerified}</td></tr>` : ""}
      ${permitCtx ? `<tr><td style="padding:8px 0;color:#64748b;font-size:12px">Market</td><td style="padding:8px 0;color:#fbbf24;font-size:12px">${permitCtx}</td></tr>` : ""}
    </table>
    <div style="background:#0d1f3c;border:1px solid #00d4ff33;border-radius:10px;padding:20px 24px;margin-bottom:24px;text-align:center">
      <p style="margin:0 0 6px;color:#e2e8f0;font-size:14px;font-weight:700">This lead is exclusive — they haven't been contacted by anyone else.</p>
      <p style="margin:0 0 18px;color:#64748b;font-size:13px">Speed wins jobs. Call now.</p>
      <a href="tel:${lead.phone}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:900;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.5px">CALL ${firstName} NOW →</a>
    </div>
    ${messageBlock}
  </div>
  <div style="padding:18px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · (313) 992-1219</p>
    <p style="margin:5px 0 0;font-size:11px"><a href="https://detroitwebagent.com" style="color:#00d4ff;text-decoration:none">detroitwebagent.com</a></p>
  </div>
</div></body></html>`;
          const pref = (lead as any).contact_preference || "call";
          const project = lead.project_type ? ` (${lead.project_type})` : "";
          const baseLine = aiSummary || `LEAD UNLOCKED`;
          const smsBody = pref === "email"
            ? `${baseLine}\n${lead.name} prefers EMAIL at ${lead.email || "no email given"}${project}. Email them — follow up within 24 hours.`
            : pref === "text"
            ? `${baseLine}\n${lead.name} — ${lead.phone}. Prefers TEXT${project}. Reach out now.`
            : `${baseLine}\n${lead.name} — ${lead.phone}${project}. CALL NOW — exclusive to you.`;

          // Subject prefers AI summary; falls back to existing static copy
          const subject = aiSummary
            ? `${breachWarn}${aiSummary}`
            : `${breachWarn}🔥 New ${tradeLabel} lead — ${lead.name} (exclusive)`;

          // Resend send — check res.ok and log silent failures
          const sendResend = (async () => {
            try {
              const r = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Detroit Web Agency <matt@detroitwebagent.com>",
                  to: [contractor.email],
                  bcc: ["matt@detroitwebagent.com"],
                  subject,
                  html: leadHtml,
                }),
                signal: AbortSignal.timeout(15_000),
              });
              if (!r.ok) {
                const errBody = await r.text().catch(() => "");
                console.error(`[LEAD-NOTIFY] Resend ${r.status}: ${errBody}`);
                await logError({
                  source: "resend",
                  function_name: "contractor-lead-notify",
                  severity: "error",
                  recipient: contractor.email,
                  payload: { lead_id: lead.id, contractor_id: contractor.id, subject },
                  error_message: `Resend HTTP ${r.status}: ${errBody.slice(0, 400)}`,
                  http_status: r.status,
                });
                return { ok: false };
              }
              return { ok: true };
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error(`[LEAD-NOTIFY] Resend exception: ${msg}`);
              await logError({
                source: "resend",
                function_name: "contractor-lead-notify",
                severity: "error",
                recipient: contractor.email,
                payload: { lead_id: lead.id, contractor_id: contractor.id, subject },
                error_message: msg,
              });
              return { ok: false };
            }
          })();

          await Promise.all([
            sendResend,
            contractor.phone
              ? sendSMS(contractor.phone, TWILIO_PHONE, smsBody, "contractor_leads")
              : Promise.resolve(),
          ]);
        }
      } else {
        // ── PPL CONTRACTOR: FOMO teaser — no contact info until paid ─────────
        if (contractor.phone) {
          // Build checkout URL — they tap it to claim for $50
          const claimUrl = `${SITE_URL}/claim-lead?lead_id=${lead.id}&contractor_id=${contractor.id}&email=${encodeURIComponent(contractor.email || "")}`;
          const smsBody = `🚨 HOT LEAD in ${site?.city || "Metro Detroit"}: ${lead.project_type || site?.trade || "service request"}.\nEXCLUSIVE — first contractor to claim it gets it.\n\n⚡ Reply CLAIM to buy instantly ($50) or tap:\n${claimUrl}`;
          await sendSMS(contractor.phone, TWILIO_PHONE, smsBody, "contractor_leads");
        }
      }

      // Mark as notified
      await sb.from("contractor_leads")
        .update({ notified_at: new Date().toISOString(), status: "notified" })
        .eq("id", lead.id);

      count++;
    }

    console.log(`[LEAD-NOTIFY] Sent ${count} notifications`);
    return new Response(JSON.stringify({ notified: count }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[LEAD-NOTIFY] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
