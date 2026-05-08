// Per-(signal, client) AI fit explainer for Demand & Buyer Radar.
// Cheap (Gemini Flash via Lovable Gateway), cached forever per (signal_id, client_id, radar).
// Returns: fit_score, fit_reason, revenue_low/high, revenue_logic, urgency_window_days,
// suggested_opener, objection_to_expect, next_best_action.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

interface SignalLike {
  id: string;
  company_name?: string | null;
  industry?: string | null;
  location?: string | null;
  county?: string | null;
  signal_type?: string | null;
  human_summary?: string | null;
  source_summary?: string | null;
  predicted_needs?: string[] | null;
  hiring_count?: number | null;
  hiring_roles?: string[] | null;
  confidence?: number | null;
  detected_at?: string | null;
  recommended_pitch?: string | null;
}

interface ClientProfile {
  id: string;
  company_name?: string | null;
  vertical?: string | null;
  buyer_type?: string | null;
  target_industries?: string[] | null;
  offering_summary?: string | null;
  avg_deal_size_usd?: number | null;
  close_rate_pct?: number | null;
  target_buyer_titles?: string[] | null;
  differentiators?: string | null;
  service_radius_miles?: number | null;
}

interface FitJSON {
  fit_score: number;
  fit_reason: string;
  revenue_low_usd: number;
  revenue_high_usd: number;
  revenue_logic: string;
  urgency_window_days: number;
  suggested_opener: string;
  objection_to_expect: string;
  next_best_action: "call" | "email" | "linkedin";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function defaultsFromClient(c: ClientProfile): { dealSize: number; closeRate: number } {
  // Sensible defaults so cards render even before /setup is filled in.
  const dealSize = c.avg_deal_size_usd && c.avg_deal_size_usd > 0
    ? c.avg_deal_size_usd
    : (c.buyer_type === "supplier" ? 25_000 : 15_000);
  const closeRate = c.close_rate_pct && c.close_rate_pct > 0 ? c.close_rate_pct : 15;
  return { dealSize, closeRate };
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<FitJSON> {
  const tool = {
    type: "function",
    function: {
      name: "emit_fit",
      description: "Emit fit reasoning + revenue band for a sales lead.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          fit_score: { type: "integer", minimum: 0, maximum: 100 },
          fit_reason: { type: "string", maxLength: 280 },
          revenue_low_usd: { type: "integer", minimum: 0 },
          revenue_high_usd: { type: "integer", minimum: 0 },
          revenue_logic: { type: "string", maxLength: 220 },
          urgency_window_days: { type: "integer", minimum: 1, maximum: 180 },
          suggested_opener: { type: "string", maxLength: 320 },
          objection_to_expect: { type: "string", maxLength: 200 },
          next_best_action: { type: "string", enum: ["call", "email", "linkedin"] },
        },
        required: [
          "fit_score",
          "fit_reason",
          "revenue_low_usd",
          "revenue_high_usd",
          "revenue_logic",
          "urgency_window_days",
          "suggested_opener",
          "objection_to_expect",
          "next_best_action",
        ],
      },
    },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "emit_fit" } },
      max_tokens: 800,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 200)}`);
  }

  const data = await resp.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no tool call");
  const parsed = JSON.parse(args) as FitJSON;
  // Sanitize
  parsed.fit_score = clamp(Math.round(parsed.fit_score), 0, 100);
  parsed.revenue_low_usd = Math.max(0, Math.round(parsed.revenue_low_usd));
  parsed.revenue_high_usd = Math.max(parsed.revenue_low_usd, Math.round(parsed.revenue_high_usd));
  parsed.urgency_window_days = clamp(parsed.urgency_window_days, 1, 180);
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const radar: "demand" | "buyer" = body?.radar === "buyer" ? "buyer" : "demand";
    const signal = body?.signal as SignalLike | undefined;
    const clientId = body?.client_id as string | undefined;
    if (!signal?.id || !clientId) {
      return new Response(JSON.stringify({ error: "signal.id and client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Cache hit?
    const { data: cached } = await sb
      .from("radar_lead_fit_cache")
      .select("*")
      .eq("signal_id", signal.id)
      .eq("client_id", clientId)
      .eq("radar", radar)
      .maybeSingle();
    if (cached) {
      return new Response(JSON.stringify({ cached: true, fit: cached }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load client profile
    const { data: clientRow, error: cErr } = await sb
      .from("industry_pulse_clients")
      .select(
        "id, company_name, vertical, buyer_type, target_industries, offering_summary, avg_deal_size_usd, close_rate_pct, target_buyer_titles, differentiators, service_radius_miles"
      )
      .eq("id", clientId)
      .maybeSingle();
    if (cErr || !clientRow) {
      return new Response(JSON.stringify({ error: "client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const client = clientRow as ClientProfile;
    const { dealSize, closeRate } = defaultsFromClient(client);

    const systemPrompt = `You are a senior B2B sales strategist. Given a buying-intent SIGNAL and a SELLER PROFILE, you produce a brutally honest, customized fit assessment for THIS specific seller.

Rules:
- fit_score 0-100: how well this lead matches THIS seller's offering, ICP, and territory. Be skeptical — most leads should land 40-70.
- fit_reason: 2 sentences, specific to BOTH the signal AND the seller's offering. Reference concrete details from each.
- revenue_low_usd / revenue_high_usd: realistic deal-size band IF THIS SELLER closes. Anchor on seller's avg deal size, adjust ±50% based on signal strength + scope. Never zero.
- revenue_logic: one sentence math: e.g. "Avg deal $${dealSize.toLocaleString()} × signal expansion scope (3x sites)".
- urgency_window_days: how long the buying window stays open. Hiring surge = 14-30d. New permit = 7-14d. RFP with due date = days remaining. Generic intent = 30-60d.
- suggested_opener: 1-3 sentence cold-outreach first message in the seller's voice. Reference the SIGNAL specifically (no generic "I noticed your company"). Mention the seller's differentiator. End with a single low-friction ask.
- objection_to_expect: most likely pushback ("we already have a vendor", "not budgeted this quarter", etc.) and why it applies here.
- next_best_action: "call" if hot (fit>=75) and phone-typical industry; "email" if mid; "linkedin" if cold/exec-level.

Output ONLY via the tool call.`;

    const userPrompt = `SELLER PROFILE
Company: ${client.company_name || "(unnamed)"}
Vertical: ${client.vertical || "(unset)"}
Buyer type: ${client.buyer_type || "(unset)"}
Target industries: ${(client.target_industries || []).join(", ") || "(any)"}
Offering: ${client.offering_summary || "(not specified — infer from vertical)"}
Differentiators: ${client.differentiators || "(not specified)"}
Avg deal size: $${dealSize.toLocaleString()}
Typical close rate: ${closeRate}%
Target buyer titles: ${(client.target_buyer_titles || []).join(", ") || "(any decision-maker)"}
Service radius: ${client.service_radius_miles || 50} miles

LEAD SIGNAL (${radar} radar)
Company: ${signal.company_name || "(unknown)"}
Industry: ${signal.industry || "(unknown)"}
Location: ${signal.location || signal.county || "(unknown)"}
Signal type: ${signal.signal_type || "(generic intent)"}
What we detected: ${signal.human_summary || signal.source_summary || signal.recommended_pitch || "(no summary)"}
Predicted needs: ${(signal.predicted_needs || []).join(", ") || "(none)"}
${signal.hiring_count ? `Hiring: ${signal.hiring_count} ${(signal.hiring_roles || []).slice(0,3).join(", ")}` : ""}
Confidence raw: ${signal.confidence ?? "n/a"}
Detected: ${signal.detected_at?.slice(0,10) || "recent"}

Now emit the fit JSON.`;

    let fit: FitJSON;
    try {
      fit = await callAI(systemPrompt, userPrompt);
    } catch (aiErr: any) {
      // Fail-soft fallback so cards still render
      console.warn("[radar-fit-explainer] AI call failed:", aiErr?.message);
      const conf = clamp(Math.round((signal.confidence ?? 0.5) * 100), 30, 75);
      fit = {
        fit_score: conf,
        fit_reason: `${signal.signal_type || "Buying intent"} detected at ${signal.company_name || "this account"} — aligns with ${client.company_name || "your"} ${client.vertical || "service"} territory. Customize fit reasoning by completing your radar setup.`,
        revenue_low_usd: Math.round(dealSize * 0.7),
        revenue_high_usd: Math.round(dealSize * 1.5),
        revenue_logic: `Anchored on your $${dealSize.toLocaleString()} avg deal × signal-strength multiplier`,
        urgency_window_days: 21,
        suggested_opener: signal.recommended_pitch || `Hi — saw ${signal.company_name || "your team"} ${signal.signal_type ? `had a ${signal.signal_type.replace(/_/g, " ")} signal` : "is in market"} this week. We help ${client.vertical || "companies"} like yours move faster on these. Worth a 10-min call?`,
        objection_to_expect: "Already have a vendor / not the right time",
        next_best_action: conf >= 70 ? "call" : "email",
      };
    }

    // Persist cache (best effort)
    const insertRow = {
      signal_id: signal.id,
      client_id: clientId,
      radar,
      fit_score: fit.fit_score,
      fit_reason: fit.fit_reason,
      revenue_low_usd: fit.revenue_low_usd,
      revenue_high_usd: fit.revenue_high_usd,
      revenue_logic: fit.revenue_logic,
      urgency_window_days: fit.urgency_window_days,
      suggested_opener: fit.suggested_opener,
      objection_to_expect: fit.objection_to_expect,
      next_best_action: fit.next_best_action,
      raw: fit as any,
    };
    const { error: insErr } = await sb.from("radar_lead_fit_cache").insert(insertRow);
    if (insErr) console.warn("[radar-fit-explainer] cache insert failed:", insErr.message);

    return new Response(JSON.stringify({ cached: false, fit: insertRow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[radar-fit-explainer] error:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || "unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
