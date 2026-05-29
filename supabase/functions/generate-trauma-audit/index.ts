// generate-trauma-audit — inspects a business homepage and generates a
// 200-250 word personalized "Revenue Leak Report" via Claude (Anthropic tier).
//
// Can be called standalone or from pod-outreach-scheduler.
// Input: POST { businessName, websiteUrl, industry, city, email?, phone? }
// Output: { auditText, traumaPoints, queueId }
import { createClient } from "npm:@supabase/supabase-js@2";
import { inspectHomepage, formatTraumaForPrompt } from "../_shared/homepage-inspector.ts";
import { generateText } from "../_shared/ai.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[TRAUMA-AUDIT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: {
    businessName?: string;
    websiteUrl?: string;
    industry?: string;
    city?: string;
    email?: string;
    phone?: string;
  } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const businessName = body.businessName ?? "this business";
  const websiteUrl   = body.websiteUrl ?? "";
  const industry     = body.industry ?? "local business";
  const city         = body.city ?? "your area";
  const email        = body.email ?? null;
  const phone        = body.phone ?? null;

  if (!websiteUrl) {
    return new Response(JSON.stringify({ error: "websiteUrl is required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Inspecting", { businessName, websiteUrl: websiteUrl.slice(0, 60) });

  // ── Phase 1: Homepage inspection ──────────────────────────────────────────
  const traumaPoints = await inspectHomepage(websiteUrl);
  if (!traumaPoints) {
    return new Response(JSON.stringify({ error: "Could not reach website — URL may be invalid or site is down" }), {
      status: 422, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Inspection complete", {
    trauma_count: traumaPoints.trauma_count,
    load_ms: traumaPoints.load_time_ms,
    https: traumaPoints.has_https,
    mobile: traumaPoints.has_mobile_viewport,
  });

  const issuesList = formatTraumaForPrompt(traumaPoints);

  // ── Phase 2: Claude audit generation ──────────────────────────────────────
  // Uses _shared/ai.ts waterfall: Lovable → Claude Haiku → GPT-4o-mini
  const prompt = `You are a no-fluff website revenue diagnostician for a web design agency.
Your job is to read raw website inspection data and write a 200-250 word personalized "Revenue Leak Report" that reads like a human expert conducted a manual review.

STRICT RULES:
- Name specific issues as revenue leaks with dollar impact framing (e.g. "losing 40% of mobile visitors")
- Use the business name "${businessName}", industry "${industry}", and city "${city}" in your observations
- Write in second person, active voice, punchy short sentences
- No headers, no bullet points, no emojis — flowing paragraphs only (2-3 short paragraphs)
- Focus on what these issues cost in real customers and real revenue, not technical jargon
- Final sentence must create urgency: "Every day ${businessName} runs without fixing this, a competing ${industry} in ${city} is capturing those calls instead."
- Output ONLY the audit text. No preamble, no metadata.

Business: ${businessName}
Industry: ${industry}
City: ${city}
Website: ${websiteUrl}

Issues Found:
${issuesList}`;

  const auditText = await generateText(prompt, 400);

  if (!auditText) {
    return new Response(JSON.stringify({ error: "AI generation failed — all providers unavailable" }), {
      status: 503, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Audit generated", { wordCount: auditText.split(/\s+/).length });

  // ── Phase 3: Store in b2b_audit_queue ─────────────────────────────────────
  const { data: queueRow, error: dbErr } = await sb
    .from("b2b_audit_queue")
    .insert({
      business_name: businessName,
      website_url:   websiteUrl,
      email,
      phone,
      industry,
      city,
      trauma_points: traumaPoints,
      audit_text:    auditText,
      audit_status:  "audited",
    })
    .select("id")
    .single();

  if (dbErr) {
    log("Queue insert error (non-fatal)", { error: dbErr.message });
  }

  return new Response(
    JSON.stringify({
      success: true,
      queueId: queueRow?.id ?? null,
      auditText,
      traumaPoints,
      traumaCount: traumaPoints.trauma_count,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
