// One-shot fix + email sender — DELETE after use.
// Fixes Matt's geo coverage and sends today's mortgage radar digest email directly.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const SECRET = "mig-2026-05-02";

const SE_MICHIGAN_ZIPS = [
  "48201","48202","48204","48205","48206","48207","48208","48209","48210","48211",
  "48213","48214","48215","48216","48217","48219","48221","48223","48224","48225",
  "48226","48227","48228","48229","48234","48235","48238","48239","48240","48243",
  "48120","48121","48122","48124","48125","48126","48127","48128","48134","48141",
  "48150","48151","48152","48153","48154","48185","48186",
  "48183","48184","48192","48193","48195","48101",
  "48088","48089","48091","48092","48093","48310","48311","48312","48313","48314",
  "48315","48316","48317","48318","48066","48080","48081","48082","48083",
  "48009","48067","48068","48069","48070","48071","48072","48073","48075","48076",
  "48220","48237","48301","48302","48303","48304","48306","48307","48308","48309",
  "48320","48321","48322","48323","48324","48325","48327","48328","48329","48330",
  "48331","48334","48335","48336","48340","48341","48342","48346","48350","48360",
  "48362","48363","48374","48375","48376","48377",
];

async function sendTwilio(to: string, body: string) {
  const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    }
  );
  const j = await r.json();
  return j.sid ? `sent:${j.sid}` : `err:${j.message}`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Mortgage Radar <matt@detroitwebagent.com>",
      to: [to],
      subject,
      html,
    }),
  });
  const j = await r.json();
  return j.id ? `sent:${j.id}` : `err:${JSON.stringify(j)}`;
}

function buildEmail(leads: any[], weekCount: number, clientName: string): { subject: string; html: string } {
  const top = leads[0];
  const signalLabel = (top?.signal_type || "").replace(/_/g, " ");
  const city = top?.city || "Metro Detroit";
  const subject = `🏠 ${leads.length} new mortgage signal${leads.length > 1 ? "s" : ""} in SE Michigan today — top score ${top?.score ?? "?"}/10 in ${city}`;

  const cards = leads.map((l: any) => {
    const scoreColor = l.score >= 9 ? "#00d4ff" : l.score >= 7 ? "#fbbf24" : "#94a3b8";
    const sig = (l.signal_type || "").replace(/_/g, " ");
    const addr = [l.address, l.city, l.zip].filter(Boolean).join(", ");
    const equity = l.estimated_equity ? `<p style="color:#94a3b8;font-size:11px;margin:4px 0;">🏠 Est. equity: $${Math.round(l.estimated_equity/1000)}k</p>` : "";
    const detail = l.signal_detail ? `<p style="color:#cbd5e1;font-size:12px;margin:4px 0;">${l.signal_detail}</p>` : "";
    const opener = l.suggested_opener ? `<p style="color:#e2e8f0;font-size:12px;font-style:italic;margin:8px 0;">"${l.suggested_opener}"</p>` : "";
    const searchQ = l.full_name
      ? encodeURIComponent(`"${l.full_name}" ${l.city || ""} phone`)
      : encodeURIComponent(`${l.address || ""} ${l.city || ""} owner`);
    return `
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:${scoreColor};font-size:22px;font-weight:700;">${l.score ?? "?"}/10</span>
          <span style="color:#64748b;font-size:11px;text-transform:uppercase;">${sig}</span>
        </div>
        <p style="color:#f1f5f9;font-weight:600;margin:8px 0 4px;">${l.full_name || "Homeowner"}</p>
        <p style="color:#94a3b8;font-size:12px;margin:2px 0;">${addr}</p>
        ${detail}${equity}${opener}
        <a href="https://www.google.com/search?q=${searchQ}" style="display:inline-block;margin-top:8px;padding:6px 12px;background:#0f172a;color:#00d4ff;border:1px solid #00d4ff;border-radius:4px;font-size:11px;text-decoration:none;">🔍 Find Contact</a>
      </div>`;
  }).join("\n");

  const html = `
<!DOCTYPE html><html><body style="background:#0a1628;font-family:Arial,sans-serif;color:#f1f5f9;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;">
  <div style="text-align:center;padding:20px 0;border-bottom:1px solid #1e293b;">
    <h1 style="color:#00d4ff;font-size:20px;margin:0;">🏠 Mortgage Radar</h1>
    <p style="color:#64748b;font-size:12px;margin:4px 0;">SE Michigan · ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
  </div>
  <div style="padding:20px 0;">
    <p style="color:#94a3b8;">Hi ${clientName},</p>
    <p style="color:#f1f5f9;">Here are today's top ${leads.length} mortgage signal${leads.length > 1 ? "s" : ""} in your market. ${weekCount} leads scanned this week.</p>
  </div>
  ${cards}
  <div style="border-top:1px solid #1e293b;padding:20px 0;text-align:center;">
    <p style="color:#64748b;font-size:11px;">${weekCount} leads scanned this week in SE Michigan · Mortgage Radar by Detroit Web Agency</p>
    <p style="color:#64748b;font-size:11px;">Questions? Reply to this email or call (313) 992-1219</p>
  </div>
</div>
</body></html>`;

  return { subject, html };
}

serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const results: Record<string, unknown> = {};
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  // 1. Fix Matt's zip_codes
  const { error: zipErr } = await sb
    .from("mortgage_radar_clients")
    .update({ zip_codes: SE_MICHIGAN_ZIPS })
    .eq("email", "matt@detroitwebagent.com");
  results.zip_fix = zipErr ? `err:${zipErr.message}` : `set ${SE_MICHIGAN_ZIPS.length} zips`;

  // 2. Get all active clients
  const { data: clients } = await sb
    .from("mortgage_radar_clients")
    .select("id, email, contact_name, business_name, zip_codes, phone")
    .eq("active", true);
  results.clients_count = clients?.length ?? 0;

  // 3. Get today's leads (only columns that definitely exist)
  const { data: leads } = await sb
    .from("mortgage_radar_leads")
    .select("id, full_name, address, city, zip, lat, lon, signal_type, signal_detail, score, suggested_opener, best_call_window, estimated_equity, intel_highlights, signal_count, last_signal_at, signal_date, created_at")
    .gte("created_at", since24h)
    .order("score", { ascending: false })
    .limit(10);
  results.leads_found = leads?.length ?? 0;

  if (!leads || leads.length === 0) {
    results.email = "skipped: no leads in last 24h";
    return new Response(JSON.stringify({ ok: true, ...results }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Week count
  const { count: weekCount } = await sb
    .from("mortgage_radar_leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since7d);

  // 5. Send digest to each active client
  let emailsSent = 0;
  const emailResults = [];
  for (const c of (clients || [])) {
    const top5 = leads.slice(0, 5);
    const name = c.contact_name || c.business_name || "Matt";
    const { subject, html } = buildEmail(top5, weekCount ?? 0, name);
    const emailResult = await sendEmail(c.email, subject, html);
    emailResults.push({ to: c.email, result: emailResult });
    if (emailResult.startsWith("sent:")) emailsSent++;
  }
  results.emails_sent = emailsSent;
  results.email_results = emailResults;

  // 6. Test SMS if requested
  if (url.searchParams.get("sms") === "1") {
    const msg = `🏠 Mortgage Radar: ${leads.length} new leads in SE Michigan today. Top score: ${leads[0]?.score}/10 in ${leads[0]?.city || "Detroit"}. Email sent. — DWA`;
    const [r1, r2] = await Promise.all([
      sendTwilio("+13139921219", msg),
      sendTwilio("+13136719441", msg),
    ]);
    results.sms_matt = r1;
    results.sms_brother = r2;
  }

  return new Response(JSON.stringify({ ok: true, ...results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
