import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/**
 * Generates a Demand Radar B2B outreach email tailored to a supplier vertical.
 * Example: Ameristeel (steel supplier) → expansion signals = construction firms breaking ground.
 * Plumbing supply → expansion signals = new multi-unit builds. Roofing supply → storm + permit signals.
 *
 * NEVER mentions: AI, scraping, Sonar, OSINT, Perplexity, license databases, Apollo.
 * Uses term: "proprietary demand signal engine"
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const {
      supplier_name,
      contact_name,
      vertical, // steel | plumbing_supply | roofing_supply | hvac_supply | electrical_supply | concrete | lumber | industrial_general
      territory,
      recent_signals, // array of { company_name, location, expansion_type, hiring_count, predicted_needs, confidence }
      cherry_picked,
    } = await req.json();

    if (!supplier_name || !vertical) {
      return new Response(JSON.stringify({ error: "supplier_name and vertical required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const VERTICAL_PITCH: Record<string, { product: string; signal: string; outcome: string }> = {
      steel: {
        product: "structural steel, rebar, beams",
        signal: "general contractors breaking ground on commercial / multi-unit projects",
        outcome: "purchase orders for 50,000+ lbs of steel within 60-90 days",
      },
      plumbing_supply: {
        product: "PEX, copper, fittings, fixtures",
        signal: "multi-unit residential and commercial builds entering rough-in phase",
        outcome: "wholesale rough-in PO's averaging $8-25k per project",
      },
      roofing_supply: {
        product: "shingles, underlayment, flashing, metal panels",
        signal: "storm damage zones + permit pulls for re-roofs",
        outcome: "contractor pallet orders within 14-30 days of storm event",
      },
      hvac_supply: {
        product: "rooftop units, ductwork, refrigerant",
        signal: "facility expansions and equipment-replacement permits",
        outcome: "RTU + install kit orders averaging $12-40k per project",
      },
      electrical_supply: {
        product: "wire, panels, gear, switchgear",
        signal: "industrial facility expansions and EV charger installs",
        outcome: "gear and wire packages averaging $20-80k per project",
      },
      concrete: {
        product: "ready-mix, rebar, forms",
        signal: "foundation permits pulled in your delivery radius",
        outcome: "yardage orders 30-45 days out",
      },
      lumber: {
        product: "framing lumber, sheathing, engineered wood",
        signal: "residential and light-commercial framing-stage projects",
        outcome: "framing packages averaging $15-60k per build",
      },
      industrial_general: {
        product: "your industrial product line",
        signal: "manufacturing expansions and capital equipment purchases",
        outcome: "qualified buying-window leads 60-90 days before competitors see them",
      },
    };

    const v = VERTICAL_PITCH[vertical] || VERTICAL_PITCH.industrial_general;

    const signalsBlock = (recent_signals || []).slice(0, 3).map((s: any, i: number) =>
      `${i + 1}. ${s.company_name} (${s.location}) — ${s.expansion_type} — ${s.predicted_needs || "expansion signal"} — confidence ${s.confidence}/10`
    ).join("\n");

    const cherryNote = cherry_picked
      ? "Lead with the FIRST signal listed — Matt hand-picked it as the strongest immediate match. Mention it specifically by company + location."
      : "";

    const system = `You are Matt Michels, founder of Detroit Web Agency. You sell "Demand Radar" — a B2B intelligence subscription that flags pre-construction expansion signals so suppliers can quote first. You are NOT pitching software, AI, or data tools. You are offering one free intelligence brief as a proof-of-concept. Never mention: AI, scraping, OSINT, Perplexity, Sonar, Apollo, license databases, web scraping, or any data source. If methodology comes up, use the term "proprietary demand signal engine." Conversational, 110-150 words, single low-friction CTA.`;

    const prompt = `Write a cold outreach email TO ${contact_name || "the Sales Manager"} at ${supplier_name}, a ${vertical.replace(/_/g, " ")} supplier${territory ? ` serving ${territory}` : ""}.

Their product line: ${v.product}.
Their ideal buying signal: ${v.signal}.
Typical outcome when they catch this signal early: ${v.outcome}.

Hook: Our demand signal engine just flagged ${(recent_signals || []).length} pre-market expansion projects in their territory that match their ideal customer profile. Offer ONE intelligence brief FREE as proof — if they win the quote, no fee. If it leads to a recurring account, they keep it.

${cherryNote}

Recent signals (mention the strongest one by company + location only — never expose data sources):
${signalsBlock}

Subject line: short, specific, no clickbait. Mention the vertical or a specific company.

Output format:
SUBJECT: <subject line>
BODY: <email body with line breaks>
CTA: "Want me to send the full brief on [company name]?"`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        max_tokens: 800,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI gateway error: ${aiRes.status} ${t}`);
    }
    const aiData = await aiRes.json();
    let draft = aiData.choices?.[0]?.message?.content || "";

    // Scrub any forbidden terms that may have slipped through
    const FORBIDDEN = [
      /\bAI\b/gi, /artificial intelligence/gi, /machine learning/gi,
      /scrap(e|ing|er)/gi, /sonar/gi, /perplexity/gi, /apollo/gi,
      /license database/gi, /OSINT/gi, /LinkedIn/gi, /MIOSHA/gi, /LARA/gi, /NPI/gi,
    ];
    FORBIDDEN.forEach(rx => { draft = draft.replace(rx, "our intelligence engine"); });

    // Audit log
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await sb.from("ai_action_queue").insert({
        action_type: "supplier_outreach_draft",
        ai_result: draft,
        context: { supplier_name, contact_name, vertical, territory, signal_count: (recent_signals || []).length },
        status: "pending",
      });
    } catch (_) { /* non-blocking */ }

    return new Response(JSON.stringify({ ok: true, draft, vertical, supplier_name }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
