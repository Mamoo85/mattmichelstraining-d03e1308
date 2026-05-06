// automated-blind-teaser-generator — Daily 8:00 AM ET cron.
// Queries last 24-48h of new licensed candidates, REDACTS all PII (name/phone/email/employer/social),
// keeps only trade + city + license_issue_date. Generates dark DWA-branded HTML email with 3 "Event" cards
// + Stripe CTA + hardcoded FCRA disclaimer. Routes to dwa-closer queue via blind_teaser_dispatches table
// for Matt's manual approval (TCPA/FCRA compliance — no auto-blast).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FCRA_DISCLAIMER = `LEGAL DISCLAIMER: This data is provided as B2B Market Intelligence only. It does not constitute a "Consumer Report" under the FCRA. The buyer assumes all liability for TCPA, CAN-SPAM, and state-level compliance during subsequent outreach.`;

interface RawCandidate {
  id: string;
  trade: string | null;
  license_type: string | null;
  city: string | null;
  license_issue_date: string | null;
  created_at: string;
}

interface RedactedEvent {
  trade_label: string;
  city: string;
  issue_date: string;
}

function tradeLabel(c: RawCandidate): string {
  const t = (c.trade || "").toLowerCase();
  const lt = (c.license_type || "").toLowerCase();
  if (t.includes("electric") || lt.includes("electric")) return "Journeyman Electrician";
  if (t.includes("plumb") || lt.includes("plumb")) return "Journeyman Plumber";
  if (t.includes("hvac") || lt.includes("hvac") || lt.includes("refrigeration")) return "HVAC Mechanical Technician";
  if (t.includes("boiler") || lt.includes("boiler") || lt.includes("stationary")) return "Licensed Boiler Operator";
  if (t.includes("weld") || lt.includes("weld")) return "Certified Welder";
  if (lt.includes("nurse practitioner")) return "Nurse Practitioner";
  if (t.includes("nursing") || lt.includes("rn") || lt.includes("lpn") || lt.includes("cna")) return "Licensed Nurse";
  if (t.includes("home_health") || lt.includes("home health") || lt.includes("aide")) return "Home Health Aide";
  return c.license_type || c.trade || "Licensed Trade Professional";
}

function fmtDate(d: string | null): string {
  if (!d) return "this week";
  try { return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

function buildTeaserHtml(events: RedactedEvent[], checkoutUrl: string): string {
  const eventCards = events.map((e, i) => `
    <tr><td style="padding:0 0 16px">
      <table width="100%" style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;border-left:3px solid #00d4ff">
        <tr><td style="padding:20px 24px">
          <div style="color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">EVENT ${i + 1}</div>
          <div style="color:#fff;font-size:18px;font-weight:700;margin:8px 0 4px">A new ${e.trade_label} license was issued in ${e.city}.</div>
          <div style="color:#94a3b8;font-size:13px">Issued ${e.issue_date}</div>
          <div style="margin-top:12px;display:inline-block;padding:4px 10px;background:#1e293b;color:#64748b;font-size:11px;border-radius:4px;font-family:monospace">█████████ ████ • ███-███-████ • ████████@█████.███ • [REDACTED]</div>
        </td></tr>
      </table>
    </td></tr>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628"><tr><td align="center" style="padding:32px 16px">
    <table width="100%" style="max-width:640px;background:#0a1628">
      <tr><td style="padding:0 0 24px">
        <div style="color:#00d4ff;font-size:13px;font-weight:700;letter-spacing:3px">DETROIT WEB AGENCY • MARKET INTELLIGENCE</div>
      </td></tr>
      <tr><td style="padding:0 0 8px">
        <h1 style="color:#fff;font-size:28px;line-height:1.2;margin:0;font-weight:800">3 New Licenses Issued in Metro Detroit</h1>
      </td></tr>
      <tr><td style="padding:0 0 24px">
        <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0">In the last 48 hours, the following raw market events were captured from public licensing registries. Identifying details are <strong style="color:#00d4ff">redacted</strong> in this preview.</p>
      </td></tr>

      ${eventCards}

      <tr><td style="padding:24px 0 16px" align="center">
        <a href="${checkoutUrl}" style="display:inline-block;padding:18px 36px;background:#00d4ff;color:#0a1628;font-weight:800;font-size:16px;text-decoration:none;border-radius:8px;letter-spacing:0.5px">Pay $399 to unlock unredacted public registry data and contact enrichment for these 3 individuals + 7 more →</a>
      </td></tr>

      <tr><td style="padding:8px 0 24px" align="center">
        <div style="color:#64748b;font-size:12px">One-time purchase • Same-trade, same-metro bonus matches included • Delivered within 60 minutes</div>
      </td></tr>

      <tr><td style="padding:24px 0 0;border-top:1px solid #1e293b">
        <div style="color:#475569;font-size:11px;line-height:1.6;font-style:italic">${FCRA_DISCLAIMER}</div>
      </td></tr>

      <tr><td style="padding:16px 0 0">
        <div style="color:#334155;font-size:11px;text-align:center">
          Detroit Web Agency • matt@detroitwebagent.com • (313) 992-1219<br>
          You're receiving this because you opted into B2B market intelligence updates.
        </div>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const sinceISO = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const { data: candidates, error } = await sb
      .from("hire_alert_candidates")
      .select("id, trade, license_type, city, license_issue_date, created_at, score")
      .gte("created_at", sinceISO)
      .not("license_issue_date", "is", null)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) throw error;

    const pool = (candidates || []) as (RawCandidate & { score?: number })[];
    if (pool.length < 3) {
      return new Response(JSON.stringify({
        success: false,
        message: `Only ${pool.length} new licensed candidates in last 48h — need 3 to generate teaser. Skipping.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const picked = pool.slice(0, 3);
    const candidateIds = picked.map(c => c.id);

    const events: RedactedEvent[] = picked.map(c => ({
      trade_label: tradeLabel(c),
      city: c.city || "Metro Detroit",
      issue_date: fmtDate(c.license_issue_date),
    }));

    const { data: dispatch, error: dispErr } = await sb
      .from("blind_teaser_dispatches")
      .insert({
        candidate_ids: candidateIds,
        trade_summary: events.map(e => e.trade_label).join(" / "),
        city_summary: events.map(e => e.city).join(", "),
        subject: "Market Alert: 3 New Licenses Issued in Metro Detroit",
        email_html: "PENDING",
        status: "pending_approval",
      })
      .select("id")
      .single();

    if (dispErr || !dispatch) throw dispErr || new Error("Failed to create dispatch row");

    const checkoutUrl = `${SUPABASE_URL}/functions/v1/create-blind-teaser-checkout?dispatch_id=${dispatch.id}`;
    const html = buildTeaserHtml(events, checkoutUrl);

    await sb.from("blind_teaser_dispatches")
      .update({ email_html: html })
      .eq("id", dispatch.id);

    await sb.from("email_reply_drafts").insert({
      to_email: "STAFFING_AGENCY_LIST",
      subject: "Market Alert: 3 New Licenses Issued in Metro Detroit",
      body: html,
      status: "pending_review",
      reason: "blind_teaser_dispatch",
      metadata: { dispatch_id: dispatch.id, candidate_count: 3, source: "automated-blind-teaser-generator" },
    }).then(() => {}).catch(() => { });

    await sb.from("agent_heartbeats").upsert({
      agent_name: "automated-blind-teaser-generator",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { dispatch_id: dispatch.id, candidates: 3, pool_size: pool.length },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      success: true,
      dispatch_id: dispatch.id,
      events,
      preview_url: `${SUPABASE_URL}/functions/v1/automated-blind-teaser-generator/preview/${dispatch.id}`,
      checkout_url: checkoutUrl,
      status: "pending_approval — review in dwa-closer queue before dispatching to staffing agency list",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("automated-blind-teaser-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
