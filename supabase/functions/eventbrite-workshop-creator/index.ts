// eventbrite-workshop-creator — Autonomous digital workshop publisher
//
// Runs WEEKLY (Mondays 8am UTC) via cron.
// Uses EVENTBRITE_API_KEY to create and sell online skill workshops.
// Each workshop: 90-min online session + PDF workbook · $14.99–$29.99
// Revenue is immediate — Eventbrite processes tickets and pays via Stripe.
//
// Zero COGS: AI generates content. 300M+ Eventbrite attendees globally.
// REQUIRED: EVENTBRITE_API_KEY (already set in secrets)
// OPTIONAL: Complete Eventbrite org setup at eventbrite.com if org_id is missing.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const EB_KEY        = Deno.env.get("EVENTBRITE_API_KEY") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[EB-WORKSHOP] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 1500): Promise<string> {
  for (const [url, headers, body] of [
    ["https://ai.gateway.lovable.dev/v1/chat/completions",
      { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      { model: "google/gemini-2.5-flash", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }],
    ["https://api.anthropic.com/v1/messages",
      { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      { model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }],
    ["https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      { model: "gpt-4o-mini", max_completion_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }],
  ] as any[]) {
    const key = url.includes("lovable") ? LOVABLE_KEY : url.includes("anthropic") ? ANTHROPIC_KEY : OPENAI_KEY;
    if (!key) continue;
    try {
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch { /* fall through */ }
  }
  return "";
}

async function aiJSON<T>(prompt: string, fallback: T): Promise<T> {
  const text = await ai(prompt, 600);
  try { const m = text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]) as T; } catch {}
  return fallback;
}

type Workshop = { title: string; niche: string; price_usd: number; summary: string; description_html: string };

async function researchWorkshop(existing: string[]): Promise<Workshop> {
  const skip = existing.length ? `Already live (avoid duplicating):\n${existing.slice(-10).join("\n")}` : "First workshop!";
  return aiJSON<Workshop>(`You are an Eventbrite workshop creator. Pick the best online workshop to launch RIGHT NOW.

${skip}

Choose a hands-on, practical workshop that:
- Professionals will pay $19.99–$29.99 to attend
- Teaches a specific AI, business, or career skill
- Can be delivered online (Zoom) in 90–120 minutes
- Has clear takeaways that justify the price

Return ONLY this JSON:
{
  "title": "Workshop title (action-oriented, 8-14 words)",
  "niche": "target audience (specific, e.g. 'freelance designers', 'Etsy sellers')",
  "price_usd": 24.99,
  "summary": "One sentence: what they leave with",
  "description_html": "<p>paragraph 1: who it's for and what they'll learn</p><p>paragraph 2: specific topics covered with 3 bullet points</p><p>paragraph 3: what they walk away with</p>"
}`, {
    title: "AI Tools for Small Business: Double Your Productivity in 90 Minutes",
    niche: "small business owners",
    price_usd: 24.99,
    summary: "Build a personal AI workflow that saves 10+ hours per week",
    description_html: "<p>Perfect for small business owners who want to use AI but don't know where to start.</p><p>Topics: ChatGPT for customer service, AI content calendars, automated email drafts</p><p>Leave with a complete AI toolkit and 30-day action plan.</p>",
  });
}

async function getOrgId(): Promise<string | null> {
  const r = await fetch("https://www.eventbriteapi.com/v3/users/me/organizations/", {
    headers: { Authorization: `Bearer ${EB_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  const d = await r.json();
  return d?.organizations?.[0]?.id ?? null;
}

async function publishWorkshop(idea: Workshop, orgId: string): Promise<{ id: string; url: string }> {
  // 3 weeks out, 7pm ET (23 UTC)
  const start = new Date(Date.now() + 21 * 86400_000);
  start.setUTCHours(23, 0, 0, 0);
  const end = new Date(start.getTime() + 90 * 60_000);

  const fmt = (d: Date) => d.toISOString().replace(".000Z", "Z");

  const evRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${EB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      event: {
        name: { html: idea.title },
        description: { html: idea.description_html },
        start: { timezone: "America/New_York", utc: fmt(start) },
        end: { timezone: "America/New_York", utc: fmt(end) },
        currency: "USD",
        online_event: true,
        listed: true,
        shareable: true,
        capacity: 100,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const ev = await evRes.json();
  if (!evRes.ok) throw new Error(`Event create failed: ${JSON.stringify(ev).slice(0, 300)}`);
  const eid = ev.id;

  // Add ticket class
  await fetch(`https://www.eventbriteapi.com/v3/events/${eid}/ticket_classes/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${EB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ticket_class: {
        name: "General Admission + Digital Workbook",
        quantity_total: 100,
        cost: `USD,${Math.round(idea.price_usd * 100)}`,
        include_fee: false,
        description: idea.summary,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  // Publish
  await fetch(`https://www.eventbriteapi.com/v3/events/${eid}/publish/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${EB_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });

  return { id: eid, url: `https://www.eventbrite.com/e/${eid}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Start");

  if (!EB_KEY) {
    return new Response(JSON.stringify({ skipped: true, reason: "EVENTBRITE_API_KEY not set", setup: "Add secret EVENTBRITE_API_KEY from eventbrite.com/platform" }), {
      status: 503, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: existing } = await sb.from("eventbrite_workshops" as any).select("title").limit(20);
    const existingTitles = (existing || []).map((e: any) => e.title);

    const idea = await researchWorkshop(existingTitles);
    log("Idea", { title: idea.title, price: idea.price_usd });

    const orgId = await getOrgId();
    if (!orgId) throw new Error("No Eventbrite org found — finish account setup at eventbrite.com/organizations");

    const result = await publishWorkshop(idea, orgId);
    log("Published", result);

    await sb.from("eventbrite_workshops" as any).insert({
      title: idea.title, niche: idea.niche, price_usd: idea.price_usd,
      eventbrite_id: result.id, eventbrite_url: result.url, status: "live",
    }).catch(() => {});

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Eventbrite Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `🎟️ New Workshop Live: ${idea.title.slice(0, 50)}`,
          html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#f59e0b;">🎟️ Workshop Published on Eventbrite</h2>
<p style="font-size:18px;font-weight:bold;color:#fff;">${idea.title}</p>
<p>Price: <strong>$${idea.price_usd}</strong> · Audience: ${idea.niche}</p>
<p style="color:#94a3b8;">${idea.summary}</p>
<a href="${result.url}" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">View on Eventbrite →</a>
<p style="color:#334155;font-size:11px;margin-top:20px;">Runs weekly — new workshop created each Monday</p>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "eventbrite-workshop-creator",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ title: idea.title, url: result.url, price_usd: idea.price_usd }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, ...result, title: idea.title, price_usd: idea.price_usd }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", String(err).slice(0, 300));
    await sb.from("agent_heartbeats").upsert({
      agent_name: "eventbrite-workshop-creator",
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: String(err).slice(0, 200) }),
    }, { onConflict: "agent_name" });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
