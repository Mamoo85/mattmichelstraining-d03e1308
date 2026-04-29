// techalert-outreach — 8am ET daily
// Reads enriched prospects from techalert_prospect_targets (score >= 3,
// owner_email set, outreach not yet sent) and sends a cold email pitching TechAlert.
// Runs after the 7am enrich drain.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const DAILY_CAP = 30; // cold emails per day
const MIN_SCORE = 3;  // skip low-signal prospects

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dwaEmail(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#0a1628">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid #00d4ff">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE HANDLE THE TECH</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.8">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · (313) 992-1219</p>
    <p style="margin:6px 0 0;color:#4a6fa5;font-size:11px"><a href="https://detroitwebagent.com/unsubscribe?email={{email}}" style="color:#4a6fa5">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

function buildEmailBody(ownerName: string | null, companyName: string, role: string, isBoiler: boolean): string {
  const greeting = ownerName ? ownerName.split(" ")[0] : "there";
  const tradeLabel = isBoiler ? "boiler/stationary engineer" : role.replace(/_/g, " ");
  const jobType = isBoiler ? "licensed boiler operators" : `qualified ${tradeLabel}s`;

  return `
<p>Hi ${greeting},</p>

<p>I noticed <strong>${companyName}</strong> is actively hiring ${jobType} — the market's tight right now and the best candidates get picked up fast.</p>

<p>I run <strong>TechAlert</strong>, a Detroit-area hiring intelligence service. We monitor job boards, licensing databases, and contractor networks 24/7 and alert you the moment a qualified candidate becomes available in your area.</p>

<p><strong>What you get:</strong></p>
<ul style="margin:8px 0;padding-left:20px">
  <li>Same-day alerts when a licensed ${tradeLabel} enters the job market near you</li>
  <li>Candidate profile: license status, years of experience, trade specialties</li>
  <li>Direct contact info so you reach them before anyone else</li>
</ul>

<p><strong>$149/month. No contract. Cancel anytime.</strong></p>

<p>Most clients fill their open role within 3 weeks. Want me to send over a sample alert for ${companyName}'s area?</p>

<p>Just reply or call/text (313) 992-1219.</p>

<p>— Matt Michels<br>Detroit Web Agency</p>
`;
}

async function sendEmail(to: string, ownerName: string | null, companyName: string, role: string, isBoiler: boolean): Promise<{ ok: boolean; id?: string; err?: string }> {
  if (!RESEND_API_KEY) return { ok: false, err: "RESEND_API_KEY not set" };

  const firstName = ownerName ? ownerName.split(" ")[0] : null;
  const subject = firstName
    ? `${firstName} — still hiring ${role.replace(/_/g, " ")}s?`
    : `${companyName} — still hiring ${role.replace(/_/g, " ")}s?`;

  const html = dwaEmail(buildEmailBody(ownerName, companyName, role, isBoiler))
    .replace("{{email}}", encodeURIComponent(to));

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt at Detroit Web Agency <matt@detroitwebagent.com>",
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, err: data?.message || JSON.stringify(data) };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  try {
    // Daily cap check
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from("techalert_prospect_targets")
      .select("id", { count: "exact", head: true })
      .not("outreach_sent_at", "is", null)
      .gte("outreach_sent_at", dayStart.toISOString());

    const remaining = DAILY_CAP - (sentToday || 0);
    if (remaining <= 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: `Daily cap of ${DAILY_CAP} already reached` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: targets, error } = await sb
      .from("techalert_prospect_targets")
      .select("id, company_name, role, is_boiler, owner_name, owner_email, score")
      .is("outreach_sent_at", null)
      .not("enriched_at", "is", null)
      .not("owner_email", "is", null)
      .gte("score", MIN_SCORE)
      .order("score", { ascending: false })
      .limit(remaining);

    if (error) throw error;
    if (!targets?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: "no eligible enriched prospects" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const t of targets) {
      const result = await sendEmail(t.owner_email, t.owner_name, t.company_name, t.role, t.is_boiler);

      if (!result.ok) {
        console.error(`[outreach] ${t.company_name}: ${result.err}`);
        failed++;
        continue;
      }

      await sb
        .from("techalert_prospect_targets")
        .update({
          outreach_sent_at: new Date().toISOString(),
          outreach_status: "sent",
        })
        .eq("id", t.id);

      sent++;
      await new Promise((r) => setTimeout(r, 200));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-outreach",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { sent, skipped, failed, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, failed, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[outreach] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
