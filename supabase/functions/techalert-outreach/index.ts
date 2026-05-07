// techalert-outreach — 8am ET daily
// Reads enriched prospects from techalert_prospect_targets (score >= 3,
// owner_email set, outreach not yet sent) and sends a cold email pitching TechAlert.
// Runs after the 7am enrich drain.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaColdEmail } from "../_shared/dwa-email.ts";
import { teaserCardHtml } from "../_shared/teaser-card.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LINKEDIN_ACCESS_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

const DAILY_CAP = 300; // cold emails per day (TechAlert)
const MIN_SCORE = 3;  // skip low-signal prospects

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fire-and-forget: look up LinkedIn profile via Apollo, then send connection request.
// Fails silently — email is the primary channel, LinkedIn is secondary touch.
async function fireLinkedInConnect(companyName: string, ownerName: string | null, prospectId: string, sb: ReturnType<typeof createClient>) {
  if (!LINKEDIN_ACCESS_TOKEN || !APOLLO_API_KEY) return;
  try {
    // Apollo people search to find LinkedIn URL
    const apolloRes = await fetch("https://api.apollo.io/api/v1/people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({ api_key: APOLLO_API_KEY, q_organization_name: companyName, person_titles: ["owner", "president", "ceo", "general manager"], page: 1, per_page: 1 }),
      signal: AbortSignal.timeout(8_000),
    }).then(r => r.json()).catch(() => null);
    const liUrl = apolloRes?.people?.[0]?.linkedin_url as string | undefined;
    if (!liUrl) return;

    // Store the URL regardless of connection outcome
    await sb.from("techalert_prospect_targets").update({ owner_linkedin_url: liUrl }).eq("id", prospectId);

    // Extract LinkedIn member ID from URL (e.g. /in/john-doe → need URN)
    // LinkedIn invitation API requires member URN — use profile lookup first
    const profileRes = await fetch(`https://api.linkedin.com/v2/people/(url=${encodeURIComponent(liUrl)})`, {
      headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(5_000),
    }).then(r => r.json()).catch(() => null);
    const memberUrn = profileRes?.id ? `urn:li:member:${profileRes.id}` : null;
    if (!memberUrn) return;

    const firstName = ownerName?.split(" ")[0] || "";
    const note = `Hi ${firstName} — noticed ${companyName} is hiring skilled tradespeople. I run TechAlert, a hiring signal monitor for Michigan contractors. Happy to connect!`.slice(0, 300);

    await fetch("https://api.linkedin.com/v2/invitations", {
      method: "POST",
      headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ invitee: { "com.linkedin.voyager.growth.invitation.InviteeProfile": { profileId: profileRes.id } }, message: note }),
      signal: AbortSignal.timeout(5_000),
    });

    await sb.from("techalert_prospect_targets").update({ li_connect_sent_at: new Date().toISOString() }).eq("id", prospectId);
  } catch (_) { /* fire-and-forget */ }
}

function buildEmailBody(ownerName: string | null, companyName: string, role: string, isBoiler: boolean, score: number, recipientEmail = ""): string {
  const greeting = ownerName ? ownerName.split(" ")[0] : "there";
  const tradeLabel = isBoiler ? "boiler/stationary engineer" : role.replace(/_/g, " ");
  const jobType = isBoiler ? "licensed boiler operators" : `qualified ${tradeLabel}s`;

  const card = teaserCardHtml({
    badge: "TALENT RADAR · LIVE SIGNAL",
    headline: `${companyName} is hiring — ${jobType} are entering the market this week`,
    scoreLabel: `Score ${score}/10 · Active hiring signal`,
    bullets: [
      `Live job postings detected on Indeed/ZipRecruiter for ${tradeLabel}`,
      "Same-day candidate alerts the moment a licensed tech goes on the market",
      "Direct contact info — call them before your competitor sees the resume",
    ],
    ctaText: "See sample alerts →",
    ctaUrl: `https://detroitwebagent.com/start-trial?product=techalert&email=${encodeURIComponent(recipientEmail)}&utm_source=cold_email&utm_medium=email&utm_campaign=techalert_d0`,
    blurContact: true,
  });

  return `
<p style="color:#e6f1ff;">Hi ${greeting},</p>
<p style="color:#e6f1ff;">I noticed <strong>${companyName}</strong> is actively hiring ${jobType} — Detroit's labor market is the tightest it's been in 5 years and the best candidates get picked up in 48 hours.</p>
<p style="color:#e6f1ff;">I run <strong>Talent Radar</strong> (formerly TechAlert). We monitor job boards, MI licensing databases, and contractor networks 24/7 and ping you the moment a qualified candidate enters the market within 30 miles of you.</p>
${card}
<p style="color:#e6f1ff;">Most clients fill their open role within 3 weeks. Want me to send a free sample alert for ${companyName}'s area?</p>
<p style="color:#e6f1ff;">Just reply or call/text (313) 992-1219.</p>
<p style="color:#e6f1ff;">— Matt Michels<br>Detroit Web Agency</p>
<p style="color:#94a3b8;font-size:13px;border-top:1px solid #1e3a5f;padding-top:12px;margin-top:16px;">P.S. — Just published a free Trades Hiring Blueprint: how to find licensed HVAC, electrical, and plumbing techs in SE Michigan before they post their resume. <a href="https://detroitwebagent.com/blueprint/hiring-blueprint.html" style="color:#00d4ff;">Get it free here →</a></p>
<p style="color:#94a3b8;font-size:13px;padding-top:8px;margin-top:4px;">P.S. #2 — Also: 27% of contractor calls go unanswered. We built Missed-Call Catch — texts every missed caller back in 60 seconds. <a href="https://detroitwebagent.com/start-trial?product=missed_call" style="color:#00d4ff;">Start free 7-day trial →</a></p>
`;
}

async function sendEmail(sb: ReturnType<typeof createClient>, to: string, ownerName: string | null, companyName: string, role: string, isBoiler: boolean, score: number) {
  const firstName = ownerName ? ownerName.split(" ")[0] : null;
  const subject = firstName
    ? `${firstName} — still hiring ${role.replace(/_/g, " ")}s?`
    : `${companyName} — still hiring ${role.replace(/_/g, " ")}s?`;

  const r = await dwaColdEmail({
    to,
    subject,
    bodyHtml: buildEmailBody(ownerName, companyName, role, isBoiler, score, to),
    product: "TechAlert",
    ctaUrl: `https://detroitwebagent.com/start-trial?product=techalert&email=${encodeURIComponent(to)}&utm_source=cold_email&utm_medium=email&utm_campaign=techalert_d0`,
    templateName: "techalert_cold_d0",
  }, sb);
  return { ok: r.ok, err: r.error };
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
      // Frequency cap: skip if this address received ANY email in the last 7 days.
      // Prevents the spam loop where one recipient gets 8+ touches in a week.
      const email = String(t.owner_email).trim().toLowerCase();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: recentSends } = await sb
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .ilike("recipient_email", email)
        .in("status", ["sent", "queued", "pending"])
        .gte("created_at", sevenDaysAgo);
      if ((recentSends ?? 0) > 0) {
        await sb.from("techalert_prospect_targets")
          .update({ outreach_status: "frequency_capped", outreach_sent_at: new Date().toISOString() })
          .eq("id", t.id);
        skipped++;
        continue;
      }

      const result = await sendEmail(sb, t.owner_email, t.owner_name, t.company_name, t.role, t.is_boiler, t.score ?? 5);

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

      // D0: fire-and-forget LinkedIn connection request (secondary touch)
      fireLinkedInConnect(t.company_name, t.owner_name, t.id, sb).catch(() => {});

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
