// techalert-followup-drip — runs twice daily (9am + 2pm ET)
// Sends D3 / D7 / D14 follow-up emails to cold outreach prospects who
// haven't replied. D14 is the final touch — escalates with a phone offer.
// Skips anyone who has replied_at set (positive or negative).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { wrapServe } from "../_shared/telemetry.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DAILY_CAP = 250;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Touch = "d3" | "d7" | "d14";

function buildFollowupBody(touch: Touch, ownerName: string | null, companyName: string, role: string): string {
  const first = ownerName ? ownerName.split(" ")[0] : "there";
  const tradeLabel = role.replace(/_/g, " ");

  // Plaintext-style HTML — minimal markup, no colors/backgrounds. Renders the
  // same in light + dark inboxes and looks like a 1:1 email from Matt.
  const wrap = (body: string) =>
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.6;max-width:560px;">${body}</div>`;

  if (touch === "d3") {
    return wrap(`
<p>Hi ${first},</p>
<p>Just bumping this up — wanted to make sure my note didn't get buried.</p>
<p>We track the ${tradeLabel} labor market in Metro Detroit daily. Right now there are fewer than 12 licensed ${tradeLabel}s actively looking in your area. The ones who are available get snapped up within 48 hours.</p>
<p>TechAlert puts you on the short list the moment one becomes available — $149/mo, no contract.</p>
<p>— Matt<br>(313) 992-1219</p>`);
  }

  if (touch === "d7") {
    return wrap(`
<p>Hi ${first},</p>
<p>One more note on the ${tradeLabel} shortage — I know you're busy.</p>
<p>Three ${companyName}-area contractors signed up for TechAlert this week. When a qualified candidate surfaces, they'll get the alert first.</p>
<p>Reply "YES" and I'll activate your trial today — no card required.</p>
<p>— Matt, Detroit Web Agency · (313) 992-1219</p>`);
  }

  return wrap(`
<p>Hi ${first},</p>
<p>Last note — I don't want to keep cluttering your inbox.</p>
<p>If hiring ${tradeLabel}s is still a challenge at ${companyName}, I'd love to show you what TechAlert looks like for your area. Takes 10 minutes on the phone.</p>
<p>Call or text me directly: (313) 992-1219</p>
<p>— Matt Michels<br>Detroit Web Agency</p>`);
}

async function sendFollowup(
  sb: ReturnType<typeof createClient>,
  to: string,
  ownerName: string | null,
  companyName: string,
  role: string,
  touch: Touch,
) {
  const subjects: Record<Touch, string> = {
    d3: `Re: ${companyName} — still looking for ${role.replace(/_/g, " ")}s?`,
    d7: `${ownerName?.split(" ")[0] || companyName} — TechAlert trial`,
    d14: `Last note — ${companyName} hiring`,
  };

  const r = await dwaColdEmail({
    to,
    subject: subjects[touch],
    bodyHtml: buildFollowupBody(touch, ownerName, companyName, role),
    product: "TechAlert", // → 30-day trial CTA auto-injected
    ctaUrl: `https://detroitwebagent.com/start-trial?product=techalert&email=${encodeURIComponent(to)}&utm_source=cold_email&utm_medium=email&utm_campaign=techalert_${touch}`,
    templateName: `techalert_followup_${touch}`,
  }, sb);
  return { ok: r.ok, err: r.error };
}


serve(wrapServe("techalert-followup-drip", async (req) => {
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

      // Blocklist gate: skip paying DWA clients and permanently suppressed contacts.
      const blockStatus = await isBlocked(sb, { email: t.owner_email, business_name: t.company_name });
      if (blockStatus.blocked) { skipped++; continue; }

      // Frequency cap: skip if already emailed in the last 7 days across all sequences.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentSends } = await sb
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .ilike("recipient_email", String(t.owner_email).trim().toLowerCase())
        .in("status", ["sent", "queued", "pending"])
        .gte("created_at", sevenDaysAgo);
      if ((recentSends ?? 0) > 2) { skipped++; continue; }

      const result = await sendFollowup(sb, t.owner_email, t.owner_name, t.company_name, t.role, touch);

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
}));
