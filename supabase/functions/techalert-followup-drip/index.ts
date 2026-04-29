// techalert-followup-drip — runs twice daily (9am + 2pm ET)
// Sends D3 / D7 / D14 follow-up emails to cold outreach prospects who
// haven't replied. D14 is the final touch — escalates with a phone offer.
// Skips anyone who has replied_at set (positive or negative).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const DAILY_CAP = 50;

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

type Touch = "d3" | "d7" | "d14";

function buildFollowupBody(touch: Touch, ownerName: string | null, companyName: string, role: string): string {
  const first = ownerName ? ownerName.split(" ")[0] : "there";
  const tradeLabel = role.replace(/_/g, " ");

  if (touch === "d3") {
    return `
<p>Hi ${first},</p>
<p>Just bumping this up — wanted to make sure my note didn't get buried.</p>
<p>We track the ${tradeLabel} labor market in Metro Detroit daily. Right now there are <strong>fewer than 12 licensed ${tradeLabel}s actively looking</strong> in your area. The ones who are available get snapped up within 48 hours.</p>
<p>TechAlert puts you on the short list the moment one becomes available — $149/mo, no contract.</p>
<p>Worth a 5-minute call? Reply here or text (313) 992-1219.</p>
<p>— Matt</p>`;
  }

  if (touch === "d7") {
    return `
<p>Hi ${first},</p>
<p>One more note on the ${tradeLabel} shortage — I know you're busy.</p>
<p>Three ${companyName}-area contractors signed up for TechAlert this week. When a qualified candidate surfaces, they'll get the alert first.</p>
<p><strong>$149/month. 30-day free trial available this week only.</strong></p>
<p>Reply "YES" and I'll activate the trial today — no card required to start.</p>
<p>— Matt, Detroit Web Agency · (313) 992-1219</p>`;
  }

  // d14 — final touch, escalate to phone
  return `
<p>Hi ${first},</p>
<p>Last note — I don't want to keep cluttering your inbox.</p>
<p>If hiring ${tradeLabel}s is still a challenge at ${companyName}, I'd love to show you what TechAlert looks like for your area. Takes 10 minutes on the phone.</p>
<p><strong>Call or text me directly: (313) 992-1219</strong><br>
Or reply "CALL" and I'll reach out at a time that works for you.</p>
<p>Either way — good luck with the search.</p>
<p>— Matt Michels<br>Detroit Web Agency</p>`;
}

async function sendFollowup(
  to: string,
  ownerName: string | null,
  companyName: string,
  role: string,
  touch: Touch,
): Promise<{ ok: boolean; id?: string; err?: string }> {
  if (!RESEND_API_KEY) return { ok: false, err: "RESEND_API_KEY not set" };

  const subjects: Record<Touch, string> = {
    d3: `Re: ${companyName} — still looking for ${role.replace(/_/g, " ")}s?`,
    d7: `${ownerName?.split(" ")[0] || companyName} — 30-day TechAlert trial (this week only)`,
    d14: `Last note — ${companyName} hiring`,
  };

  const html = dwaEmail(buildFollowupBody(touch, ownerName, companyName, role))
    .replace("{{email}}", encodeURIComponent(to));

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt at Detroit Web Agency <matt@detroitwebagent.com>",
        to: [to],
        subject: subjects[touch],
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
  const now = Date.now();

  try {
    // Daily cap across all touches
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from("techalert_prospect_targets")
      .select("id", { count: "exact", head: true })
      .or(`followup_d3_sent_at.gte.${dayStart.toISOString()},followup_d7_sent_at.gte.${dayStart.toISOString()},followup_d14_sent_at.gte.${dayStart.toISOString()}`);

    let remaining = DAILY_CAP - (sentToday || 0);
    if (remaining <= 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: `Daily cap of ${DAILY_CAP} already reached` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch all prospects that had D0 sent and haven't finished the sequence or replied
    const { data: targets, error } = await sb
      .from("techalert_prospect_targets")
      .select("id, company_name, role, owner_name, owner_email, outreach_sent_at, followup_d3_sent_at, followup_d7_sent_at, followup_d14_sent_at")
      .not("outreach_sent_at", "is", null)
      .not("owner_email", "is", null)
      .is("replied_at", null)
      .is("followup_d14_sent_at", null)
      .order("outreach_sent_at", { ascending: true })
      .limit(remaining);

    if (error) throw error;
    if (!targets?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: "no prospects in drip window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const t of targets) {
      if (sent >= remaining) break;

      const d0At = new Date(t.outreach_sent_at).getTime();
      const daysSinceD0 = (now - d0At) / 86400000;

      // Determine which touch to send
      let touch: Touch | null = null;
      if (daysSinceD0 >= 14 && !t.followup_d14_sent_at) touch = "d14";
      else if (daysSinceD0 >= 7 && !t.followup_d7_sent_at) touch = "d7";
      else if (daysSinceD0 >= 3 && !t.followup_d3_sent_at) touch = "d3";

      if (!touch) { skipped++; continue; }

      const result = await sendFollowup(t.owner_email, t.owner_name, t.company_name, t.role, touch);

      if (!result.ok) {
        console.error(`[drip] ${t.company_name} ${touch}: ${result.err}`);
        failed++;
        continue;
      }

      const updateField = touch === "d3" ? "followup_d3_sent_at"
        : touch === "d7" ? "followup_d7_sent_at"
        : "followup_d14_sent_at";

      await sb
        .from("techalert_prospect_targets")
        .update({ [updateField]: new Date().toISOString() })
        .eq("id", t.id);

      sent++;
      await new Promise((r) => setTimeout(r, 150));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-followup-drip",
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
    console.error("[drip] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
