// fiverr-meta-agent — Autonomous Fiverr business intelligence + growth agent
//
// Runs WEEKLY (Monday 8am) via cron. Does NOT wait to be asked.
// What it does autonomously every week:
//   1. Analyzes order volume + revenue by gig type from fiverr_orders table
//   2. Flags top performers (scale) and dead weight (kill/revise)
//   3. Researches 3 trending gig niches using AI market intelligence
//   4. Auto-writes full gig listings for those 3 niches → stores as drafts
//   5. Generates 1 sample portfolio image per new gig idea
//   6. Emails Matt with briefing + new gig copy + sample images
//   7. Records heartbeat to agent_heartbeats
//
// NOTE: New gig ideas flagged here need a fulfillment function built if they
// are image gigs or highly specialized. Text-based gigs are auto-handled by
// fiverr-order-intake's catch-all "other" type.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";

const sb  = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[META-AGENT] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// ── AI call (waterfall) ────────────────────────────────────────────────────────
async function ai(prompt: string, maxTokens = 2000): Promise<string> {
  if (LOVABLE_KEY) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(25_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  if (ANTHROPIC_KEY) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(25_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.content?.[0]?.text?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  if (OPENAI_KEY) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_completion_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(25_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  return "";
}

async function aiJSON<T>(prompt: string, fallback: T): Promise<T> {
  const text = await ai(prompt + "\n\nRespond with valid JSON only.", 1500);
  try { const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : fallback; }
  catch { return fallback; }
}

// ── 1. Order analytics ─────────────────────────────────────────────────────────
async function analyzeOrders() {
  const { data: orders } = await sb.from("fiverr_orders")
    .select("gig_type, price_cents, status, created_at")
    .gte("created_at", daysAgo(30));

  const stats: Record<string, { orders: number; revenue: number; delivered: number }> = {};
  for (const o of orders || []) {
    if (!stats[o.gig_type]) stats[o.gig_type] = { orders: 0, revenue: 0, delivered: 0 };
    stats[o.gig_type].orders++;
    stats[o.gig_type].revenue += o.price_cents || 0;
    if (o.status === "delivered") stats[o.gig_type].delivered++;
  }

  const sorted = Object.entries(stats).sort((a, b) => b[1].orders - a[1].orders);
  const topPerformers  = sorted.slice(0, 3);
  const deadWeight     = sorted.filter(([, s]) => s.orders === 0);
  const totalOrders    = (orders || []).length;
  const totalRevenue   = Object.values(stats).reduce((s, v) => s + v.revenue, 0);

  return { stats, topPerformers, deadWeight, totalOrders, totalRevenue };
}

// ── 2. Trend research + new gig ideas ─────────────────────────────────────────
interface GigOpportunity {
  gig_type: string;
  title: string;
  niche: string;
  why_now: string;
  estimated_demand: "high" | "medium" | "low";
  fulfillment_type: "text" | "image";
  needs_new_function: boolean;
  image_prompt: string;
}

async function researchOpportunities(existingGigTypes: string[]): Promise<GigOpportunity[]> {
  const prompt = `You are a Fiverr market analyst in May 2025. Identify exactly 3 high-demand gig opportunities that are:
- Currently trending on Fiverr right now
- Deliverable with AI in under 2 minutes
- NOT already in this list: ${existingGigTypes.join(", ")}
- Priced between $10–$50 per order
- Prefer text-based gigs (copy, scripts, plans) — these work with any AI
- Flag image gigs clearly so a custom fulfillment function can be built

Return JSON array of exactly 3:
[{
  "gig_type": "snake_case_identifier",
  "title": "I will [verb] [thing] for [buyer] (under 70 chars)",
  "niche": "one sentence describing the buyer and deliverable",
  "why_now": "one sentence on why demand is high this week",
  "estimated_demand": "high" | "medium" | "low",
  "fulfillment_type": "text" | "image",
  "needs_new_function": false,
  "image_prompt": "photorealistic product mockup showing this gig's deliverable, portfolio sample, clean studio background"
}]`;

  return aiJSON<GigOpportunity[]>(prompt, []);
}

// ── Generate sample image for a gig opportunity ────────────────────────────────
async function generateSampleImage(opp: GigOpportunity): Promise<string | null> {
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
  if (!OPENAI_KEY || !opp.image_prompt) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: opp.image_prompt,
        n: 1, size: "1536x1024", quality: "medium", output_format: "png",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json();
    if (!data.data?.[0]?.b64_json) return null;
    const bytes = Uint8Array.from(atob(data.data[0].b64_json), c => c.charCodeAt(0));
    try { await sb.storage.createBucket("fiverr-samples", { public: true }); } catch { }
    const path = `${opp.gig_type}-${Date.now()}.png`;
    const { error } = await sb.storage.from("fiverr-samples").upload(path, new Blob([bytes], { type: "image/png" }), { upsert: true });
    if (error) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/fiverr-samples/${path}`;
  } catch { return null; }
}

// ── 3. Auto-write gig listings ─────────────────────────────────────────────────
interface GigDraft {
  gig_type: string;
  title: string;
  description: string;
  packages: { basic: string; standard: string; premium: string };
  requirements: string;
}

async function writeGigListing(opp: GigOpportunity): Promise<GigDraft | null> {
  const prompt = `Write a complete Fiverr gig listing for this opportunity:
Title: ${opp.title}
Niche: ${opp.niche}
Why now: ${opp.why_now}

Write the full listing as JSON:
{
  "gig_type": "${opp.gig_type}",
  "title": "${opp.title}",
  "description": "4-6 sentence compelling gig description (benefits-first, specific, no fluff)",
  "packages": {
    "basic": "Basic package: what's included, price $X, delivery X days",
    "standard": "Standard package: what's included, price $X, delivery X days",
    "premium": "Premium package: what's included, price $X, delivery X days"
  },
  "requirements": "What the buyer must provide (3-5 bullet points)"
}`;

  return aiJSON<GigDraft>(prompt, null as any);
}

// ── 4. Build + send briefing email ────────────────────────────────────────────
async function sendBriefing(
  analytics: Awaited<ReturnType<typeof analyzeOrders>>,
  opportunities: GigOpportunity[],
  draftsCreated: GigDraft[],
  sampleImages: (string | null)[],
) {
  if (!RESEND_KEY) return;

  const { topPerformers, deadWeight, totalOrders, totalRevenue } = analytics;

  const statsHtml = topPerformers.length
    ? `<h3 style="color:#22c55e;">Top Performers (last 30 days)</h3>
       <table style="width:100%;border-collapse:collapse;">
         <tr style="background:#1e293b;"><th style="padding:8px;text-align:left;font-size:11px;">Gig</th><th style="padding:8px;text-align:right;font-size:11px;">Orders</th><th style="padding:8px;text-align:right;font-size:11px;">Revenue</th></tr>
         ${topPerformers.map(([type, s]) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px;">${type.replace(/_/g, " ")}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px;">${s.orders}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px;">$${(s.revenue / 100).toFixed(0)}</td></tr>`).join("")}
       </table>`
    : `<p style="color:#64748b;font-size:13px;">No orders yet — gig drafts below are ready to post.</p>`;

  const deadHtml = deadWeight.length
    ? `<h3 style="color:#ef4444;">Dead Weight — Zero orders in 30 days</h3>
       <ul>${deadWeight.map(([type]) => `<li style="font-size:12px;">${type.replace(/_/g, " ")} — revise or pause</li>`).join("")}</ul>`
    : "";

  const draftsHtml = draftsCreated.length
    ? `<h3 style="color:#60a5fa;">3 New Gig Opportunities — Copy + Sample Images</h3>
       ${draftsCreated.map((d, i) => {
         const opp = opportunities[i];
         const img = sampleImages[i];
         const needsBuild = opp?.needs_new_function
           ? `<div style="background:#7c2d12;border-radius:6px;padding:8px;margin-top:8px;font-size:11px;color:#fed7aa;">⚠️ NEEDS NEW FULFILLMENT FUNCTION — this is an image gig. Tell Claude to build it before posting.</div>`
           : `<div style="background:#14532d;border-radius:6px;padding:8px;margin-top:8px;font-size:11px;color:#bbf7d0;">✅ Text gig — auto-handled by fiverr-order-intake catch-all. Post and you're done.</div>`;
         return `
         <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:16px;">
           ${img ? `<img src="${img}" alt="${d.title}" style="width:100%;border-radius:6px;margin-bottom:12px;display:block;" />` : ""}
           <strong style="color:#e2e8f0;font-size:14px;">${d.title}</strong>
           ${needsBuild}
           <div style="margin-top:12px;">
             <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">DESCRIPTION</div>
             <div style="background:#0f172a;border-radius:6px;padding:10px;font-size:11px;color:#94a3b8;white-space:pre-wrap;">${d.description}</div>
           </div>
           <div style="margin-top:10px;">
             <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">PACKAGES</div>
             <div style="background:#0f172a;border-radius:6px;padding:10px;font-size:11px;color:#94a3b8;">Basic: ${d.packages?.basic || "TBD"}<br/>Standard: ${d.packages?.standard || "TBD"}<br/>Premium: ${d.packages?.premium || "TBD"}</div>
           </div>
           <div style="margin-top:10px;">
             <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">BUYER REQUIREMENTS</div>
             <div style="background:#0f172a;border-radius:6px;padding:10px;font-size:11px;color:#94a3b8;white-space:pre-wrap;">${d.requirements}</div>
           </div>
         </div>`;
       }).join("")}`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:auto;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <span style="font-size:24px;">🤖</span>
        <div>
          <strong style="color:#a78bfa;font-size:16px;">Fiverr Meta-Agent Weekly Briefing</strong>
          <div style="font-size:11px;color:#64748b;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          <div style="font-size:20px;font-weight:bold;color:#22c55e;">${totalOrders}</div>
          <div style="font-size:10px;color:#64748b;">orders/30d</div>
        </div>
        <div style="margin-left:16px;text-align:right;">
          <div style="font-size:20px;font-weight:bold;color:#22c55e;">$${(totalRevenue / 100).toFixed(0)}</div>
          <div style="font-size:10px;color:#64748b;">revenue/30d</div>
        </div>
      </div>
      ${statsHtml}${deadHtml}${draftsHtml}
      <hr style="border:none;border-top:1px solid #334155;margin:20px 0;" />
      <p style="font-size:11px;color:#475569;text-align:center;">Fiverr Meta-Agent · Weekly · Ran autonomously</p>
    </div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Fiverr Meta-Agent <matt@detroitwebagent.com>",
      to: [OWNER_EMAIL],
      subject: `🤖 Fiverr Daily: ${totalOrders} orders · ${draftsCreated.length} new gig drafts created`,
      html,
    }),
  });
}

// ── Main handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });

  log("Starting daily run");

  try {
    // 1. Analyze existing orders
    const analytics = await analyzeOrders();
    log("Analytics done", { totalOrders: analytics.totalOrders, gigTypes: Object.keys(analytics.stats).length });

    // 2. Research new opportunities
    const existingTypes = Object.keys(analytics.stats);
    const opportunities = await researchOpportunities(existingTypes);
    log("Opportunities found", { count: opportunities.length });

    // 3. Auto-write listings for top 2 opportunities
    // Write all 3 listings + generate sample images in parallel
    const [draftsCreated, sampleImages] = await Promise.all([
      (async () => {
        const out: GigDraft[] = [];
        for (const opp of opportunities) {
          const draft = await writeGigListing(opp);
          if (draft?.title) {
            await sb.from("fiverr_gig_drafts").insert({
              gig_type: draft.gig_type, title: draft.title, description: draft.description,
              packages: draft.packages, requirements: draft.requirements, source: "meta_agent", status: "draft",
            }).catch(e => log("Draft insert failed", { e: String(e) }));
            out.push(draft);
            log("Draft created", { title: draft.title });
          }
        }
        return out;
      })(),
      Promise.all(opportunities.map(opp => generateSampleImage(opp))),
    ]);
    log("Images done", { generated: sampleImages.filter(Boolean).length });

    // 4. Send briefing
    await sendBriefing(analytics, opportunities, draftsCreated, sampleImages);
    log("Briefing sent");

    // 5. Record heartbeat
    await sb.from("agent_heartbeats").upsert({
      agent_name:  "fiverr-meta-agent",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({
        total_orders:    analytics.totalOrders,
        total_revenue:   analytics.totalRevenue,
        opportunities:   opportunities.length,
        drafts_created:  draftsCreated.length,
      }),
    }, { onConflict: "agent_name" }).catch(() => {});

    return new Response(JSON.stringify({
      ok: true,
      total_orders:   analytics.totalOrders,
      total_revenue:  analytics.totalRevenue,
      opportunities:  opportunities.length,
      drafts_created: draftsCreated.length,
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    log("Fatal error", { err: String(err) });
    await sb.from("agent_heartbeats").upsert({
      agent_name: "fiverr-meta-agent", last_run_at: new Date().toISOString(),
      last_status: "error", last_result: String(err),
    }, { onConflict: "agent_name" }).catch(() => {});
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
