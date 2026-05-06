// Generates human_summary, suggested_opener (SMS+email+voicemail), buyer_type chip,
// and applies deterministic signal_strength_tier from signal_strength_rules table.
// Backfills existing leads on first run.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const SOURCE_TABLES = [
  { table: "mortgage_radar_leads", product: "mortgage", buyer: "Loan Officers" },
  { table: "industry_pulse_signals", product: "demand", buyer: "Wholesale Suppliers" },
  { table: "hire_alert_candidates", product: "talent", buyer: "Recruiters & GMs" },
];

const TIER_FROM_SCORE = (score: number, ageDays: number): "hot" | "warm" | "cool" => {
  if (score >= 8 && ageDays <= 7) return "hot";
  if (score >= 6 && ageDays <= 30) return "warm";
  return "cool";
};

// Multi-signal stacking + NOAA storm boost (capped at 10).
function applyScoreBoosts(baseScore: number, row: any): number {
  let s = baseScore || 5;
  const enrich = row.free_enrichment || {};
  // NOAA storm in the last 90d adds +1
  if (enrich?.noaa?.recent_storm_count > 0 || enrich?.storm_recent === true) s += 1;
  // Multi-signal stacking: each extra signal_type beyond the first adds +1, cap +2
  const stackCount = Array.isArray(row.signal_stack) ? row.signal_stack.length : 0;
  if (stackCount > 1) s += Math.min(stackCount - 1, 2);
  return Math.min(s, 10);
}

async function summarizeLead(sb: any, row: any, product: string, buyer: string) {
  const prompt = `You are formatting one lead for a marketplace dossier card. Output STRICT JSON only.

Lead: ${product} signal "${row.signal_type || "unknown"}" score ${row.score || 5}
Address: ${row.address || row.location || "unknown"}, ${row.city || ""} ${row.state || ""}
Buyer audience: ${buyer}
${row.full_name ? `Owner: ${row.full_name}` : ""}
${row.notes ? `Notes: ${row.notes}` : ""}

Return JSON with this exact shape:
{
  "human_summary": "ONE sentence (max 22 words) explaining what this signal means in plain English for a ${buyer.toLowerCase()}",
  "buyer_type": "Short chip label (2-3 words) e.g. 'Refi Candidate' or 'Storm Damage Repair'",
  "suggested_opener": {
    "sms": "Cold-open SMS, max 160 chars, casual, references the signal naturally, NO emojis",
    "email_subject": "Subject line max 50 chars",
    "email_body": "3-sentence email body, professional, references signal",
    "voicemail": "Spoken voicemail script, 15 seconds when read aloud"
  }
}

Rules: never invent contact info. Never claim certainty. Output JSON only.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You output strict JSON only. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.warn("[summarize]", e instanceof Error ? e.message : String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: { lead_id?: string; table?: string; limit?: number } = {};
  try { body = await req.json(); } catch { /* default */ }

  const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);
  const trace: any[] = [];
  let processed = 0;

  for (const src of SOURCE_TABLES) {
    if (body.table && body.table !== src.table) continue;

    let q = (sb.from as any)(src.table).select("*").is("human_summary", null).limit(limit);
    if (body.lead_id) q = (sb.from as any)(src.table).select("*").eq("id", body.lead_id);

    const { data: rows, error } = await q;
    if (error) { trace.push({ table: src.table, error: error.message }); continue; }

    for (const row of rows || []) {
      const ageDays = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000);
      const boostedScore = applyScoreBoosts(row.score || 5, row);
      const tier = TIER_FROM_SCORE(boostedScore, ageDays);

      const summary = await summarizeLead(sb, row, src.product, src.buyer);
      const update: Record<string, unknown> = {
        signal_strength_tier: tier,
        days_on_radar: ageDays,
        score: boostedScore,
      };
      if (summary) {
        update.human_summary = summary.human_summary;
        update.buyer_type = summary.buyer_type;
        update.suggested_opener = summary.suggested_opener;
      }

      // Append to score_history when score changes — only for tables that have the column.
      // Currently only mortgage_radar_leads has score_history.
      if (src.table === "mortgage_radar_leads" && (row.score || 5) !== boostedScore) {
        const prevHistory = Array.isArray(row.score_history) ? row.score_history : [];
        const nextHistory = [
          ...prevHistory,
          { score: boostedScore, at: new Date().toISOString() },
        ].slice(-20); // cap at last 20 entries
        update.score_history = nextHistory;
      }

      await (sb.from as any)(src.table).update(update).eq("id", row.id);
      trace.push({ table: src.table, id: row.id, tier, summarized: !!summary });
      processed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, trace }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
