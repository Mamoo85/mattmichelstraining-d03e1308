// dwa-closer — omni-channel bundle pitch agent (runs daily 2pm ET)
// Finds warm/exhausted prospects, generates personalized closing emails
// via free Gemini, routes through ghost delay (email_reply_drafts),
// texts Matt a 10-min preview with cancel link.
//
// Zone 1 fix: Firecrawl fetch has AbortController 5s timeout
// Zone 5 fix: AI prompt explicitly bans the word "AI" in output

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const MAX_SCRAPES_PER_RUN = 3;
const GHOST_DELAY_MINUTES = 10;

// ── Fallback email templates (rotated by prospect index) ───────────────────
const FALLBACK_TEMPLATES = [
  (p: { business_name: string; city?: string; trade?: string; industry?: string }) => `Hi,

I help ${p.trade || p.industry || "trade"} businesses in ${p.city || "Metro Detroit"} win back old leads they've already paid for.

Most contractors have 50–200 old quotes sitting in their files — people who called, got a price, and went quiet. We send a 3-message text sequence from your business name. When someone replies interested, you get an instant text. You only pay $50 when a lead actually responds.

I also help with dispatcher tools and hiring alerts for licensed techs — could roll everything into one package.

Worth a quick call this week?

Matt Michels
Detroit Web Agency
(313) 992-1219`,

  (p: { business_name: string; city?: string; trade?: string; industry?: string }) => `Hi,

Quick question — does ${p.business_name || "your company"} have a list of old leads who never booked?

We help ${p.trade || p.industry || "trade"} contractors in ${p.city || "Metro Detroit"} turn those into revenue. Text drip from your business name, $50 only when someone replies. No monthly fee, no ads, no guesswork.

If that's useful, I can also show you how we handle dispatcher-to-tech communication and track available licensed workers in the area.

Happy to send a short demo — just reply here.

Matt Michels
Detroit Web Agency
(313) 992-1219`,

  (p: { business_name: string; city?: string; trade?: string; industry?: string }) => `Hi,

I work with ${p.trade || p.industry || "trade"} companies in ${p.city || "the Metro Detroit area"} on three things: reactivating dead leads ($50/reply, no monthly fee), dispatcher software that works in a boiler room, and daily alerts when licensed techs become available in your area.

Not sure which fits ${p.business_name || "your business"} best — could be all three, could be just one. Either way worth a 10-minute call.

Matt Michels
Detroit Web Agency
(313) 992-1219`,
];

// ── Firecrawl with 5-second timeout (Zone 1 fix) ───────────────────────────
async function scrapeWebsite(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    clearTimeout(timeoutId);
    if (!res.ok) return "";
    const data = await res.json();
    return (data?.data?.markdown || "").slice(0, 800);
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    const isAbort = e instanceof Error && e.name === "AbortError";
    console.warn(`[dwa-closer] Firecrawl ${isAbort ? "timed out" : "failed"} for ${url}`);
    return "";
  }
}

// ── Anti-collision check ────────────────────────────────────────────────────
async function isOnCooldown(
  sb: ReturnType<typeof createClient>,
  email: string
): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Check outreach_cooldowns — skip if a different agent contacted this prospect
  const { data: cooldown } = await sb
    .from("outreach_cooldowns" as any)
    .select("last_agent, last_contacted_at")
    .eq("prospect_email", email)
    .gte("last_contacted_at", sevenDaysAgo)
    .maybeSingle();

  if (cooldown && cooldown.last_agent !== "closer") return true;

  // Belt-and-suspenders: check system_comms_log for any recent sends
  // (catches Tom, prospector, and drip emails logged via DB trigger)
  if (!cooldown) {
    const { data: recentComms } = await sb
      .from("system_comms_log" as any)
      .select("created_at")
      .eq("recipient", email)
      .gte("created_at", sevenDaysAgo)
      .limit(1);
    if (recentComms?.length) return true;
  }

  // Check suppressed_emails (bounces / complaints)
  const { data: suppressed } = await sb
    .from("suppressed_emails" as any)
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (suppressed) return true;

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  let scrapeCount = 0;
  let queued = 0;
  let skipped = 0;

  try {
    // ── Step 1: Prospect selection (max 5 per run) ──────────────────────────
    // Pool A: responded to dead lead reactivation pitch
    const { data: poolA } = await sb
      .from("outreach_leads" as any)
      .select("id, business_name, email, website, city, trade, industry, ai_drafted_pitch")
      .eq("status", "Responded")
      .eq("offer_pitched", "dead_lead_reactivation")
      .is("email", "not.null")
      .limit(5);

    // Pool B: drip-exhausted (d8 follow-up sent, no conversion yet)
    const { data: poolB } = await sb
      .from("outreach_leads" as any)
      .select("id, business_name, email, website, city, trade, industry, ai_drafted_pitch")
      .eq("status", "emailed")
      .eq("offer_pitched", "dead_lead_reactivation")
      .is("email", "not.null")
      .limit(10);

    // Take up to 5 total, Pool A priority
    const candidates = [
      ...(poolA || []),
      ...(poolB || []),
    ].slice(0, 5);

    for (let idx = 0; idx < candidates.length; idx++) {
      const prospect = candidates[idx];
      if (!prospect.email) { skipped++; continue; }

      // ── Step 2: Anti-collision ────────────────────────────────────────────
      const onCooldown = await isOnCooldown(sb, prospect.email);
      if (onCooldown) { skipped++; continue; }

      // ── Step 3: Context gathering ─────────────────────────────────────────
      const { data: commsHistory } = await sb
        .from("system_comms_log" as any)
        .select("channel, subject, created_at")
        .eq("recipient", prospect.email)
        .order("created_at", { ascending: false })
        .limit(10);

      const historyText = (commsHistory || [])
        .map((c: any) => `${c.channel} on ${c.created_at?.slice(0, 10)}: ${c.subject || "(SMS)"}`)
        .join("\n") || "No prior contact on record.";

      // ── Step 4: Live recon (credit-conscious, Zone 1 safe) ────────────────
      let websiteContext = prospect.ai_drafted_pitch || "";

      if (!websiteContext && prospect.website && FIRECRAWL_API_KEY && scrapeCount < MAX_SCRAPES_PER_RUN) {
        const md = await scrapeWebsite(prospect.website);
        if (md) {
          scrapeCount++;
          websiteContext = md;
          // Cache result for future runs
          await sb
            .from("outreach_leads" as any)
            .update({ ai_drafted_pitch: `cache:${now.toISOString()}|${md}` })
            .eq("id", prospect.id);
        }
      }

      // Final fallback: use business metadata
      if (!websiteContext) {
        websiteContext = `Business: ${prospect.business_name}, Industry: ${prospect.trade || prospect.industry || "trade"}, City: ${prospect.city || "Metro Detroit"}`;
      }

      // ── Step 5: Email generation (free Gemini, Zone 5 no-AI rule) ─────────
      const prompt = `You are a closing specialist for Detroit Web Agency writing a personalized B2B outreach email.

PROSPECT:
- Business: ${prospect.business_name}
- City: ${prospect.city || "Metro Detroit"}
- Trade/Industry: ${prospect.trade || prospect.industry || "unknown"}
- Website intel: ${websiteContext.slice(0, 400)}

PRIOR CONTACT HISTORY:
${historyText}

BUNDLE OFFER (pick the angle most relevant to this prospect):
1. Dead Lead Reactivation — $50/reply (no monthly fee, text drip from their business name, turns old quotes into cash)
2. FieldDesk — $199/mo dispatcher + tech mobile app (replaces eWay CRM, works offline in boiler rooms)
3. TechAlert — $99/mo hiring monitor (daily alerts when licensed tradespeople become available in their area)

RULES:
1. Write a plain-text email body only (no subject line, no HTML)
2. Under 180 words
3. One specific observation about their business based on the website intel or trade
4. Lead with the most compelling offer angle for their situation
5. End with a soft CTA (quick call, reply to this email)
6. Sign as: Matt Michels / Detroit Web Agency / (313) 992-1219
7. Do NOT reference prior contact unless history shows a specific reply from them
8. CRITICAL: Never use the words "AI", "artificial intelligence", "machine learning", or "algorithm" — use "system", "process", or "matching engine" instead
9. Sound like a real person, not a mass email`;

      let emailBody = await generateText(prompt, 600);

      // Fallback to pre-written template if AI returns empty
      if (!emailBody || emailBody.length < 50) {
        emailBody = FALLBACK_TEMPLATES[idx % FALLBACK_TEMPLATES.length]({
          business_name: prospect.business_name,
          city: prospect.city,
          trade: prospect.trade,
          industry: prospect.industry,
        });
      }

      const subject = `Quick question for ${prospect.business_name}`;

      // ── Step 6: Ghost delay — route through email_reply_drafts ────────────
      const sendAfter = new Date(now.getTime() + GHOST_DELAY_MINUTES * 60 * 1000).toISOString();

      await sb.from("email_reply_drafts" as any).insert({
        to_email: prospect.email,
        subject,
        body: emailBody,
        send_after: sendAfter,
        category: "dwa_closer_bundle_pitch",
        prospect_id: prospect.id,
      });

      // ── Step 7: Preview SMS to Matt ───────────────────────────────────────
      const preview = emailBody.slice(0, 120).replace(/\n/g, " ");
      await sendSMS(
        ADMIN_PHONE,
        TWILIO_PHONE_NUMBER,
        `Pitch queued: ${prospect.business_name} (${prospect.email}). Sends in ${GHOST_DELAY_MINUTES}min. Preview: "${preview}..."`,
        "dwa_closer"
      );

      // ── Step 8: Record cooldown ───────────────────────────────────────────
      await sb.from("outreach_cooldowns" as any).upsert({
        prospect_email: prospect.email,
        last_agent: "closer",
        last_contacted_at: now.toISOString(),
        last_channel: "email",
      }, { onConflict: "prospect_email" });

      queued++;
    }

    // ── Step 9: Heartbeat ─────────────────────────────────────────────────
    await sb.from("agent_heartbeats" as any).upsert({
      agent_name: "dwa-closer",
      last_run_at: now.toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ queued, skipped, scrapeCount }),
    }, { onConflict: "agent_name" });

    console.log(`[dwa-closer] queued=${queued} skipped=${skipped} scrapes=${scrapeCount}`);
    return new Response(
      JSON.stringify({ ok: true, queued, skipped, scrapeCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dwa-closer] Fatal error:", msg);

    await sb.from("agent_heartbeats" as any).upsert({
      agent_name: "dwa-closer",
      last_run_at: now.toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: msg }),
    }, { onConflict: "agent_name" }).catch(() => {});

    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
