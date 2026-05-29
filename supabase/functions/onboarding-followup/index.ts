// onboarding-followup — daily cron that nudges clients who haven't finished setup.
// D3: gentle reminder with same instructions. D7: final nudge + offer a call.
// Only runs for site_radar (checks crm_visitor_events) and missed_call (checks missed_call_captures).
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail } from "../_shared/dwa-email.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const SITE = "https://detroitwebagent.com";

function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return e164;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const now = Date.now();
  const d3 = new Date(now - 3 * 86400_000).toISOString();
  const d7 = new Date(now - 7 * 86400_000).toISOString();
  const d8 = new Date(now - 8 * 86400_000).toISOString();

  let nudged = 0;

  // ── SiteRadar: clients with no visitor events yet ────────────────────────
  const { data: siteClients } = await sb
    .from("field_crm_clients")
    .select("id, email, business_name, visitor_script_key, dispatch_token, created_at")
    .eq("status", "active")
    .lte("created_at", d3);

  for (const c of siteClients || []) {
    const email = c.email;
    if (!email) continue;

    // Check if they have any visitor events yet
    const { count: events } = await sb
      .from("crm_visitor_events")
      .select("id", { count: "exact", head: true })
      .eq("visitor_script_key", c.visitor_script_key || "");

    if ((events ?? 0) > 0) continue; // pixel installed, skip

    const createdAt = new Date(c.created_at).getTime();
    const isD7 = createdAt <= new Date(d7).getTime() && createdAt > new Date(d8).getTime();
    const isD3 = !isD7 && createdAt <= new Date(d3).getTime();
    if (!isD3 && !isD7) continue;

    const tplName = isD7 ? "onboarding_siteradar_d7" : "onboarding_siteradar_d3";

    // Skip if this specific template already sent
    const { count: alreadySent } = await sb
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient_email", email.trim().toLowerCase())
      .eq("template_name", tplName)
      .in("status", ["sent", "pending"]);
    if ((alreadySent ?? 0) > 0) continue;

    const scriptKey = c.visitor_script_key || c.dispatch_token || "YOUR_KEY";
    const dashUrl = `${SITE}/my-site-radar?token=${scriptKey}`;
    const name = c.business_name?.split(" ")[0] || "there";

    let subject: string;
    let bodyHtml: string;

    if (isD3) {
      subject = "Quick reminder: SiteRadar isn't tracking yet";
      bodyHtml = `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:600px;">
<p style="margin:0 0 16px;">Hey ${name},</p>
<p style="margin:0 0 16px;">Just checking in — SiteRadar is still set up and ready, but the tracking pixel hasn't been installed on your website yet, so your visitor feed is empty.</p>
<p style="margin:0 0 16px;">It's a single line of code. The fastest path if you're not a tech person: <strong>reply to this email</strong> and I'll do a 10-minute screen share and install it for you right now.</p>
<p style="margin:0 0 16px;">Or forward this email to whoever manages your website — they'll know exactly what to do:</p>
<div style="background:#f4f4f4;border:2px solid #00d4ff;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-family:monospace;font-size:12px;word-break:break-all;line-height:1.7;">&lt;script&gt;\n(function(k){fetch('${SUPABASE_URL}/functions/v1/visitor-identify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({script_key:k,page:location.href,referrer:document.referrer})})})('${scriptKey}');\n&lt;/script&gt;</div>
<p style="margin:0 0 24px;"><a href="${dashUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Open my SiteRadar dashboard →</a></p>
<p style="margin:0;">— Matt · (313) 992-1219</p>
</div>`;
    } else {
      subject = "SiteRadar: last nudge — want me to install it for you?";
      bodyHtml = `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:600px;">
<p style="margin:0 0 16px;">Hey ${name},</p>
<p style="margin:0 0 16px;">One week in and SiteRadar still isn't tracking — which means you're flying blind on who's visiting your site.</p>
<p style="margin:0 0 16px;padding:16px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;"><strong>Easiest option:</strong> Text me "pixel" at <strong>(313) 992-1219</strong> and I'll jump on a 10-minute call and install it for you. No tech knowledge needed on your end.</p>
<p style="margin:0 0 16px;">Or reply to this email with access to your website and I'll handle it.</p>
<p style="margin:0 0 24px;"><a href="${dashUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Open my SiteRadar dashboard →</a></p>
<p style="margin:0;">— Matt · (313) 992-1219</p>
</div>`;
    }

    const r = await dwaEmail({ to: email, subject, html: bodyHtml });
    await sb.from("email_send_log").insert({
      template_name: tplName, recipient_email: email.trim().toLowerCase(),
      status: r.ok ? "sent" : "failed", error_message: r.error ?? null,
      metadata: { product: "site_radar", followup_day: isD7 ? 7 : 3 },
    }).catch(() => {});
    if (r.ok) nudged++;
  }

  // ── Missed-Call: clients with no captures yet ────────────────────────────
  const { data: mcClients } = await sb
    .from("missed_call_clients")
    .select("id, email, business_name, phone, dashboard_token, created_at")
    .eq("active", true)
    .lte("created_at", d3);

  for (const c of mcClients || []) {
    const email = c.email;
    if (!email) continue;

    const { count: captures } = await sb
      .from("missed_call_captures")
      .select("id", { count: "exact", head: true })
      .eq("client_id", c.id);

    if ((captures ?? 0) > 0) continue; // already receiving calls, skip

    const createdAt = new Date(c.created_at).getTime();
    const isD7 = createdAt <= new Date(d7).getTime() && createdAt > new Date(d8).getTime();
    const isD3 = !isD7 && createdAt <= new Date(d3).getTime();
    if (!isD3 && !isD7) continue;

    const tplName = isD7 ? "onboarding_missed_call_d7" : "onboarding_missed_call_d3";

    const { count: alreadySent } = await sb
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient_email", email.trim().toLowerCase())
      .eq("template_name", tplName)
      .in("status", ["sent", "pending"]);
    if ((alreadySent ?? 0) > 0) continue;

    const fwdTo = formatPhone(TWILIO_NUMBER);
    const rawDigits = TWILIO_NUMBER.replace(/\D/g, "");
    const name = c.business_name?.split(" ")[0] || "there";
    const dashUrl = `${SITE}/my-missed-call?token=${c.dashboard_token || ""}`;

    let subject: string;
    let bodyHtml: string;

    if (isD3) {
      subject = "Missed-Call Catch isn't active yet — here's the one step";
      bodyHtml = `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:600px;">
<p style="margin:0 0 16px;">Hey ${name},</p>
<p style="margin:0 0 16px;">Missed-Call Catch is still waiting on one step: forwarding your business line to our catch number. Until that's done, missed calls go to voicemail instead of getting auto-texted back.</p>
<div style="background:#f0f9ff;border:2px solid #00d4ff;border-radius:8px;padding:20px;margin:0 0 20px;text-align:center;">
<p style="margin:0 0 8px;font-size:14px;color:#555;">Forward missed calls to:</p>
<p style="margin:0;font-size:28px;font-weight:900;color:#0a1628;">${fwdTo}</p>
</div>
<p style="margin:0 0 16px;"><strong>Quickest path (regular landline or cell):</strong><br>
From your business phone, dial <code style="background:#f4f4f4;padding:2px 8px;border-radius:4px;font-weight:bold;">*72${rawDigits}</code> and press Call. Done.</p>
<p style="margin:0 0 16px;"><strong>Not sure how?</strong> Text me "phone setup" at <strong>(313) 992-1219</strong> — I'll walk you through it in under 10 minutes.</p>
<p style="margin:0 0 24px;"><a href="${dashUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Open my Missed-Call dashboard →</a></p>
<p style="margin:0;">— Matt · (313) 992-1219</p>
</div>`;
    } else {
      subject = "Missed-Call Catch: still one step away — text me and we'll do it together";
      bodyHtml = `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:600px;">
<p style="margin:0 0 16px;">Hey ${name},</p>
<p style="margin:0 0 16px;">One week in and Missed-Call Catch still isn't active. Every missed call is going to voicemail instead of getting auto-texted back.</p>
<p style="margin:0 0 16px;padding:16px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;"><strong>Text me "phone setup" at (313) 992-1219</strong> and I'll get on a 10-minute call and walk you through the forwarding step. It takes less time than setting up voicemail.</p>
<p style="margin:0 0 24px;"><a href="${dashUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Open my Missed-Call dashboard →</a></p>
<p style="margin:0;">— Matt · (313) 992-1219</p>
</div>`;
    }

    const r = await dwaEmail({ to: email, subject, html: bodyHtml });
    await sb.from("email_send_log").insert({
      template_name: tplName, recipient_email: email.trim().toLowerCase(),
      status: r.ok ? "sent" : "failed", error_message: r.error ?? null,
      metadata: { product: "missed_call", followup_day: isD7 ? 7 : 3 },
    }).catch(() => {});
    if (r.ok) nudged++;
  }

  return new Response(JSON.stringify({ ok: true, nudged }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
