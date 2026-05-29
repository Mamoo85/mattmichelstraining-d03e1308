// fiverr-order-intake — Parses Fiverr requirement emails, generates deliverables, emails Matt
//
// Called by Gmail Apps Script every 5 min when Fiverr sends "Requirements Submitted" emails.
// POST: { email_subject, email_body, fiverr_order_id? }
// Response: { success: true, order_id, gig_type, result_preview }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY      = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY     = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY   = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY      = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL     = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[INTAKE] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

// ── AI call (waterfall: Lovable → Anthropic → OpenAI) ─────────────────────────
async function ai(prompt: string, maxTokens = 2048): Promise<string> {
  if (LOVABLE_KEY) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(20_000),
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
        signal: AbortSignal.timeout(20_000),
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
        signal: AbortSignal.timeout(20_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  return "";
}

// ── Gig type detection + requirement extraction ────────────────────────────────
const GIG_TYPES = ["blog_post","thumbnail","press_release","social_captions","video_script","proposal","sales_script","website_copy","brand_names","headshot","other"];

async function parseOrder(subject: string, body: string): Promise<{ gig_type: string; requirements: Record<string, string>; buyer_notes: string }> {
  const prompt = `You are parsing a Fiverr order requirements email. Extract the order details.

EMAIL SUBJECT: ${subject}
EMAIL BODY (first 3000 chars):
${body.slice(0, 3000)}

Classify the gig type as exactly one of: ${GIG_TYPES.join(", ")}

Return JSON only:
{
  "gig_type": "<one of the types above>",
  "requirements": { "key": "value pairs of everything the buyer submitted" },
  "buyer_notes": "any special instructions or notes from the buyer"
}`;

  const text = await ai(prompt, 512);
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fall through */ }
  return { gig_type: "other", requirements: {}, buyer_notes: body.slice(0, 500) };
}

// ── Generate deliverable by gig type ──────────────────────────────────────────
const GIG_PROMPTS: Record<string, (r: Record<string, string>, notes: string) => string> = {
  blog_post: (r, notes) => `Write a complete, engaging 500-700 word blog post.
Business/Topic: ${r.business_name || r.topic || r.subject || "as described"}
Industry: ${r.industry || r.niche || "general"}
Target audience: ${r.audience || "general readers"}
Keywords: ${r.keywords || "none specified"}
Tone: ${r.tone || "professional"}
Special instructions: ${notes}
Include: catchy headline, engaging intro, 3 value sections with subheadings, strong CTA. Format as clean HTML.`,

  press_release: (r, notes) => `Write a professional press release.
Company: ${r.company_name || r.business_name || "the company"}
Announcement: ${r.announcement || r.topic || notes}
Key facts: ${r.facts || r.details || "as provided"}
Spokesperson: ${r.spokesperson || "Company spokesperson"}
Location: ${r.location || ""}
Format with: FOR IMMEDIATE RELEASE header, headline, subheadline, 5W lead paragraph, 2-3 body paragraphs with a quote, boilerplate, contact info placeholder.`,

  social_captions: (r, notes) => `Write 10 social media captions for:
Business: ${r.business_name || "the brand"}
Industry: ${r.industry || r.niche || "general"}
Platform: ${r.platform || "Instagram, Facebook, LinkedIn"}
Goal: ${r.goal || "engagement and brand awareness"}
Tone: ${r.tone || "professional but friendly"}
Topics to cover: ${r.topics || notes}
Include relevant hashtags for each. Mix promotional (3), educational (4), and engagement posts (3).`,

  video_script: (r, notes) => `Write a complete video script.
Topic: ${r.topic || r.title || notes}
Platform: ${r.platform || "YouTube"}
Target length: ${r.length || "5-8 minutes"}
Target audience: ${r.audience || "general"}
Key points to cover: ${r.points || r.outline || notes}
Format: Hook (first 3 seconds), intro, main sections with timestamps, CTA. Include [B-ROLL] and [ON-SCREEN TEXT] suggestions.`,

  proposal: (r, notes) => `Write a complete business proposal.
Client name: ${r.client_name || "the client"}
Project: ${r.project || r.scope || notes}
Your company: ${r.company_name || "our company"}
Timeline: ${r.timeline || "TBD"}
Budget range: ${r.budget || "TBD"}
Include: executive summary, scope of work, deliverables, timeline, investment table, next steps. Professional tone.`,

  sales_script: (r, notes) => `Write a complete sales outreach package.
Product/Service: ${r.product || r.service || notes}
Target customer: ${r.target || r.audience || "business owners"}
Industry: ${r.industry || "general"}
Main value prop: ${r.value_prop || notes}
Include:
1. 5-email cold sequence (subject lines + body for each)
2. 30-second cold call opener with pattern interrupt
3. Follow-up call script
4. Top 5 objections with exact-word rebuttals`,

  website_copy: (r, notes) => `Rewrite website copy to convert visitors into leads.
Business: ${r.business_name || "the business"}
Industry: ${r.industry || "general"}
Main service/product: ${r.service || r.product || notes}
Target customer: ${r.audience || "general"}
Current pain points: ${r.pain_points || notes}
Write: hero headline + subheadline, 3 value propositions, social proof section, FAQ (6 questions), 3 CTAs. Clear, compelling, no jargon.`,

  brand_names: (r, notes) => `Generate creative business names and slogans.
Industry: ${r.industry || "general business"}
Brand vibe: ${r.vibe || r.style || "modern and professional"}
Keywords: ${r.keywords || notes}
Deliver: 10 unique name ideas (mix one-word, compound, invented), 5 matching slogans (5 words max each), domain availability advice.`,

  thumbnail: (r, _notes) => `THUMBNAIL_IMAGE:${JSON.stringify(r)}`,
  headshot: (r, _notes) => `HEADSHOT_IMAGE:${JSON.stringify(r)}`,
  other: (r, notes) => `Complete the following Fiverr order as requested. Requirements: ${JSON.stringify(r)}. Buyer notes: ${notes}. Deliver professional, high-quality output.`,
};

async function generate(gigType: string, requirements: Record<string, string>, buyerNotes: string): Promise<{ result: string; resultUrl?: string; isImage: boolean }> {
  const promptFn = GIG_PROMPTS[gigType] || GIG_PROMPTS.other;
  const prompt = promptFn(requirements, buyerNotes);

  // Image gigs — route to deployed image functions
  if (prompt.startsWith("THUMBNAIL_IMAGE:")) {
    const r = requirements;
    const fnUrl = `${SUPABASE_URL}/functions/v1/youtube-thumbnail-generator`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ title: r.title || r.video_title || buyerNotes, channel_niche: r.niche || r.channel || "", style: r.style || "dramatic" }),
      signal: AbortSignal.timeout(130_000),
    });
    const data = await res.json();
    return { result: data.thumbnail_url || "Image generation failed", resultUrl: data.thumbnail_url, isImage: true };
  }

  if (prompt.startsWith("HEADSHOT_IMAGE:")) {
    const r = requirements;
    const fnUrl = `${SUPABASE_URL}/functions/v1/ai-headshots-generator`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ photo_url: r.photo_url || "", order_id: "fiverr-intake" }),
      signal: AbortSignal.timeout(130_000),
    });
    const data = await res.json();
    return { result: JSON.stringify(data.images || {}), resultUrl: data.images?.studio, isImage: true };
  }

  // Text gigs
  const result = await ai(prompt, 2048);
  return { result: result || "Generation failed — retrying manually.", isImage: false };
}

// ── Email Matt with the result ─────────────────────────────────────────────────
async function emailResult(orderId: string, fiverrOrderId: string | null, gigType: string, requirements: Record<string, string>, result: string, isImage: boolean, resultUrl?: string) {
  if (!RESEND_KEY) return;

  const gigLabel = gigType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const previewText = isImage
    ? `<p>🖼️ <strong>Image ready:</strong> <a href="${resultUrl}" style="color:#60a5fa;">${resultUrl}</a></p>`
    : `<div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;font-family:monospace;font-size:12px;color:#e2e8f0;white-space:pre-wrap;max-height:600px;overflow-y:auto;">${result.slice(0, 4000).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:auto;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <span style="font-size:24px;">🚀</span>
        <div>
          <strong style="color:#22c55e;font-size:16px;">Fiverr Order Ready to Deliver</strong>
          <div style="font-size:12px;color:#64748b;">Order ${fiverrOrderId || orderId} · ${gigLabel}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${Object.entries(requirements).slice(0, 8).map(([k, v]) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px;width:35%;">${k}</td><td style="padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px;">${String(v).slice(0, 120)}</td></tr>`
        ).join("")}
      </table>

      <h3 style="color:#a78bfa;margin:16px 0 8px;">Generated Result</h3>
      ${previewText}

      <div style="background:#0c1222;border:1px solid #334155;border-radius:8px;padding:12px;margin-top:16px;">
        <p style="margin:0;font-size:13px;color:#94a3b8;">
          📋 <strong style="color:#e2e8f0;">How to deliver:</strong>
          Open Fiverr → Orders → ${fiverrOrderId || "this order"} → Deliver → paste the content above → click Submit Delivery.
          Takes ~30 seconds.
        </p>
      </div>
    </div>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Fiverr Agent <matt@detroitwebagent.com>",
      to: [OWNER_EMAIL],
      subject: `🚀 Ready to deliver: ${gigLabel} order ${fiverrOrderId || orderId}`,
      html,
    }),
  });
}

// ── Main handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { email_subject?: string; email_body?: string; fiverr_order_id?: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS }); }

  const { email_subject = "", email_body = "", fiverr_order_id } = body;
  if (!email_body) return new Response(JSON.stringify({ error: "email_body required" }), { status: 400, headers: CORS });

  log("New order email", { subject: email_subject, orderId: fiverr_order_id });

  try {
    // 1. Parse the email
    const { gig_type, requirements, buyer_notes } = await parseOrder(email_subject, email_body);
    log("Parsed", { gig_type, requirements });

    // 2. Generate the deliverable
    const { result, resultUrl, isImage } = await generate(gig_type, requirements, buyer_notes);
    log("Generated", { gig_type, isImage, preview: result.slice(0, 80) });

    // 3. Store in DB
    const { data: order } = await sb.from("fiverr_orders").insert({
      fiverr_order_id: fiverr_order_id || null,
      gig_type,
      buyer_requirements: requirements,
      generated_result: result,
      result_url: resultUrl || null,
      status: "generated",
      raw_email_body: email_body.slice(0, 5000),
    }).select("id").single();

    const orderId = order?.id || "unknown";
    log("Stored", { orderId });

    // 4. Email Matt
    await emailResult(orderId, fiverr_order_id || null, gig_type, requirements, result, isImage, resultUrl);
    log("Emailed Matt");

    return new Response(JSON.stringify({
      success: true,
      order_id: orderId,
      gig_type,
      result_preview: result.slice(0, 200),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    log("Error", { err: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
