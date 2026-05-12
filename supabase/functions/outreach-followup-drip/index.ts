// outreach-followup-drip — D3 / D7 / D14 follow-ups for outreach_leads
// Mirrors techalert-followup-drip. Skips replied or blocked contacts.
// Caps 250/day. Plain-mode email (avoid spam from rich HTML).

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

function buildBody(touch: Touch, firstName: string, companyName: string, industry: string | null): string {
  const trade = industry || "contractor";

  if (touch === "d3") {
    return `Hi ${firstName},

Just bumping this up — wanted to make sure my note didn't get buried.

We help ${trade} businesses in Detroit capture missed calls, recover dead leads, and surface live homeowner signals before competitors do. Most owners save 6+ hours a week and pick up 1-2 extra jobs/month.

Would a 7-day trial be useful? No credit card.

— Matt
Detroit Web Agency · (313) 992-1219`;
  }

  if (touch === "d7") {
    return `Hi ${firstName},

Quick follow-up — three ${trade} owners around ${companyName}'s area started trials this week.

If you want a no-card 7-day trial just reply "YES" and I'll set you up today.

— Matt
Detroit Web Agency · (313) 992-1219`;
  }

  return `Hi ${firstName},

Last note — I don't want to keep cluttering your inbox.

If saving missed-call revenue at ${companyName} is still a goal, call or text me directly: (313) 992-1219. Takes 10 minutes.

— Matt Michels
Detroit Web Agency`;
}

async function sendFollowup(
  sb: ReturnType<typeof createClient>,
  to: string,
  firstName: string,
  companyName: string,
  industry: string | null,
  touch: Touch,
) {
  const subjects: Record<Touch, string> = {
    d3: `Re: ${companyName} — still buried in missed calls?`,
    d7: `${firstName} — 7-day trial`,
    d14: `Last note — ${companyName}`,
  };

  const body = buildBody(touch, firstName, companyName, industry);
  const bodyHtml = body
    .split("\n\n")
    .map((p) => `<p style="color:#e6f1ff;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const r = await dwaColdEmail({
    to,
    subject: subjects[touch],
    bodyHtml,
    product: "DWA",
    plainMode: true,
    ctaUrl: `https://detroitwebagent.com/start-trial?email=${encodeURIComponent(to)}&utm_source=cold_email&utm_medium=email&utm_campaign=outreach_${touch}`,
    templateName: `outreach_followup_${touch}`,
  }, sb);
  return { ok: r.ok, err: r.error };
}

serve(wrapServe("outreach-followup-drip", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;
  const now = Date.now();

  try {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await sb
      .from("outreach_leads")
      .select("id", { count: "exact", head: true })
      .or(`followup_d3_sent_at.gte.${dayStart.toISOString()},followup_d7_sent_at.gte.${dayStart.toISOString()},followup_d14_sent_at.gte.${dayStart.toISOString()}`);

    let remaining = DAILY_CAP - (sentToday || 0);
    if (remaining <= 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "daily cap reached" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch candidates: D0 was sent (last_contact_date set), not replied, not yet finished
    const { data: targets, error } = await sb
      .from("outreach_leads")
      .select("id, business_name, owner_name, first_name, owner_email, enriched_email, validated_email, email, industry, last_contact_date, followup_d3_sent_at, followup_d7_sent_at, followup_d14_sent_at")
      .not("last_contact_date", "is", null)
      .is("replied_at", null)
      .is("followup_d14_sent_at", null)
      .order("last_contact_date", { ascending: true })
      .limit(remaining * 2);

    if (error) throw error;
    if (!targets?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "no candidates" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const t of targets) {
      if (sent >= remaining) break;

      const email = t.owner_email || t.enriched_email || t.validated_email || t.email;
      if (!email) { skipped++; continue; }

      const d0At = new Date(t.last_contact_date as string).getTime();
      const daysSinceD0 = (now - d0At) / 86400000;

      let touch: Touch | null = null;
      if (daysSinceD0 >= 14 && !t.followup_d14_sent_at) touch = "d14";
      else if (daysSinceD0 >= 7 && !t.followup_d7_sent_at) touch = "d7";
      else if (daysSinceD0 >= 3 && !t.followup_d3_sent_at) touch = "d3";

      if (!touch) { skipped++; continue; }

      const block = await isBlocked(sb, { email: String(email), business_name: t.business_name as string });
      if (block.blocked) { skipped++; continue; }

      // Frequency cap: skip if 2+ sends in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: recentSends } = await sb
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .ilike("recipient_email", String(email).trim().toLowerCase())
        .in("status", ["sent", "queued", "pending"])
        .gte("created_at", sevenDaysAgo);
      if ((recentSends ?? 0) > 2) { skipped++; continue; }

      const firstName = (t.first_name as string) ||
        (t.owner_name ? String(t.owner_name).split(" ")[0] : "there");
      const company = (t.business_name as string) || "your business";

      const r = await sendFollowup(sb, String(email), firstName, company, t.industry as string | null, touch);

      if (!r.ok) {
        console.error(`[outreach-drip] ${company} ${touch}: ${r.err}`);
        failed++;
        continue;
      }

      const updateField = touch === "d3" ? "followup_d3_sent_at"
        : touch === "d7" ? "followup_d7_sent_at"
        : "followup_d14_sent_at";

      await sb.from("outreach_leads").update({ [updateField]: new Date().toISOString() }).eq("id", t.id);

      sent++;
      await new Promise((r) => setTimeout(r, 150));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "outreach-followup-drip",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { sent, skipped, failed, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ ok: true, sent, skipped, failed, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[outreach-drip] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}));
