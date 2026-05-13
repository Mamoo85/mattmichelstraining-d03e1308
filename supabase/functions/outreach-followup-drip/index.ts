// outreach-followup-drip — D3 / D7 / D14 follow-ups for outreach_leads
// Mirrors techalert-followup-drip. Skips replied or blocked contacts.
// Caps 250/day. Plain-mode email (avoid spam from rich HTML).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { wrapServe } from "../_shared/telemetry.ts";
import { isBlocked } from "../_shared/outreach-blocklist.ts";
import { isTradesIndustry, tradeNoun } from "../_shared/industry-filter.ts";
import { wasContactedRecently } from "../_shared/cold-email-dedup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const DAILY_CAP = 250;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Touch = "d3" | "d7" | "d14";

// Detroit Web Agency one-liner — used the first time we name the brand so
// recipients understand WHO is emailing them and WHAT we do.
const DWA_TAGLINE = "Detroit Web Agency builds automated lead-capture systems for local trades — missed-call texting, dead-lead reactivation, and live homeowner permit/storm signals.";

function buildBody(touch: Touch, firstName: string, companyName: string, industry: string | null, city: string | null): string {
  const trade = tradeNoun(industry);
  const cityPhrase = city ? `${city}-area` : "Detroit-area";

  if (touch === "d3") {
    return `Hi ${firstName},

Just bumping this up — wanted to make sure my note didn't get buried.

${DWA_TAGLINE}

For ${companyName}, the biggest win is usually Missed-Call Catch: every call that hits voicemail gets an instant text-back, so you stop losing jobs to whoever picks up first. Owners typically pick up 1-2 extra jobs/month from that one feature.

Would a 7-day trial be useful? No credit card.

— Matt
Detroit Web Agency · (313) 992-1219`;
  }

  if (touch === "d7") {
    return `Hi ${firstName},

Quick follow-up — three other ${cityPhrase} ${trade} owners kicked off a free week of Detroit Web Agency this week.

${DWA_TAGLINE}

What the 7-day trial includes (no card, cancel anytime):
• Missed-Call Catch — auto-texts every missed call so you stop losing jobs to voicemail
• Dead Lead Reactivation — wakes up old quotes that ghosted you (you only pay when one replies)
• Live homeowner signals in your service area — permits, storm damage, FSBOs, estate sales

Reply "YES" and I'll have it live for ${companyName} today — takes me about 10 minutes on my end, zero on yours.

— Matt
Detroit Web Agency · (313) 992-1219`;
  }

  return `Hi ${firstName},

Last note — I don't want to keep cluttering your inbox.

If recovering missed-call revenue at ${companyName} is still on the list, the easiest path is a 7-day free trial of our Missed-Call Catch + Dead Lead Reactivation. No card. Reply YES, or call/text me direct: (313) 992-1219.

— Matt Michels
Detroit Web Agency`;
}

async function sendFollowup(
  sb: ReturnType<typeof createClient>,
  to: string,
  firstName: string,
  companyName: string,
  industry: string | null,
  city: string | null,
  touch: Touch,
) {
  const subjects: Record<Touch, string> = {
    d3: `${companyName} — still losing jobs to voicemail?`,
    d7: `${firstName} — 7-day free trial for ${companyName}`,
    d14: `${companyName} — last note on the 7-day trial`,
  };

  const body = buildBody(touch, firstName, companyName, industry, city);
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
    allowSubdomain: true,
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
      .select("id, business_name, owner_name, first_name, owner_email, enriched_email, validated_email, email, industry, city, last_contact_date, followup_d3_sent_at, followup_d7_sent_at, followup_d14_sent_at")
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

      // Industry gate — skip non-trades verticals (manufacturing, property mgmt,
      // restaurants, etc.) since this pitch is contractor-only.
      if (!isTradesIndustry(t.industry as string | null)) { skipped++; continue; }

      const d0At = new Date(t.last_contact_date as string).getTime();
      const daysSinceD0 = (now - d0At) / 86400000;

      let touch: Touch | null = null;
      if (daysSinceD0 >= 14 && !t.followup_d14_sent_at) touch = "d14";
      else if (daysSinceD0 >= 7 && !t.followup_d7_sent_at) touch = "d7";
      else if (daysSinceD0 >= 3 && !t.followup_d3_sent_at) touch = "d3";

      if (!touch) { skipped++; continue; }

      const block = await isBlocked(sb, { email: String(email), business_name: t.business_name as string });
      if (block.blocked) { skipped++; continue; }

      // Frequency cap: max 1 send per 5 days across ALL templates/products.
      // Stops cross-product collisions (siteradar + techalert + missed-call
      // hitting the same address in one day).
      if (await wasContactedRecently(sb, String(email), 5)) { skipped++; continue; }

      const firstName = (t.first_name as string) ||
        (t.owner_name ? String(t.owner_name).split(" ")[0] : "there");
      const company = (t.business_name as string) || "your business";

      const r = await sendFollowup(
        sb,
        String(email),
        firstName,
        company,
        t.industry as string | null,
        (t.city as string | null) ?? null,
        touch,
      );

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
