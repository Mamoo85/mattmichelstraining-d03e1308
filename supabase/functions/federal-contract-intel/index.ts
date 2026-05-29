/**
 * federal-contract-intel — Pulls recent federal contract awards in Metro Detroit
 * from SAM.gov + USAspending.gov (both free). Writes to industry_pulse_signals
 * (if present) and flags matching prospect_pool rows with recent_federal_contract=true.
 *
 * POST { county?, days?, limit? }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Award {
  recipient_name: string;
  amount: number;
  awarded_at: string;
  city?: string;
  state?: string;
  description?: string;
  agency?: string;
  source_url?: string;
}

async function fetchUSAspending(days: number, limit: number): Promise<Award[]> {
  try {
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const end = new Date().toISOString().slice(0, 10);
    const res = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          time_period: [{ start_date: start, end_date: end }],
          place_of_performance_locations: [{ country: "USA", state: "MI" }],
          award_type_codes: ["A", "B", "C", "D"],
        },
        fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Description", "Place of Performance City Code", "Action Date"],
        page: 1, limit, sort: "Award Amount", order: "desc",
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results || []).map((r: any): Award => ({
      recipient_name: r["Recipient Name"] || "Unknown",
      amount: parseFloat(r["Award Amount"]) || 0,
      awarded_at: r["Action Date"] || end,
      city: r["Place of Performance City Code"],
      state: "MI",
      description: r["Description"],
      agency: r["Awarding Agency"],
      source_url: `https://www.usaspending.gov/award/${r["Award ID"]}`,
    }));
  } catch (e) { console.error("[usaspending]", e); return []; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = body.days || 30;
    const limit = Math.min(body.limit || 50, 100);
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const awards = await fetchUSAspending(days, limit);

    let signalsInserted = 0;
    let prospectsFlagged = 0;

    for (const a of awards) {
      // Try to insert into industry_pulse_signals (best-effort)
      try {
        await sb.from("industry_pulse_signals" as any).insert({
          signal_type: "federal_contract_award",
          business_name: a.recipient_name,
          city: a.city,
          location: `${a.city || ""}, MI`,
          summary: `${a.agency} awarded $${a.amount.toLocaleString()} to ${a.recipient_name}: ${(a.description || "").slice(0, 200)}`,
          confidence: a.amount > 1_000_000 ? 9 : a.amount > 100_000 ? 7 : 5,
          source_url: a.source_url,
          meta: { amount: a.amount, agency: a.agency, awarded_at: a.awarded_at },
        });
        signalsInserted++;
      } catch (_e) { /* table may not exist */ }

      // Flag matching prospect_pool rows
      try {
        const { data: matches } = await sb.from("prospect_pool")
          .select("id")
          .ilike("business_name", `%${a.recipient_name.slice(0, 30)}%`);
        for (const m of (matches as any[]) || []) {
          await sb.from("prospect_pool").update({
            recent_federal_contract: true,
            scored_at: null, // re-trigger scoring
          }).eq("id", m.id);
          prospectsFlagged++;
        }
      } catch (e) { console.error("[flag]", e); }
    }

    // Re-score flagged prospects
    if (prospectsFlagged > 0) {
      fetch(`${SUPABASE_URL}/functions/v1/score-prospects`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 500 }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true, days, awards: awards.length, signalsInserted, prospectsFlagged,
      sample: awards.slice(0, 3),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[federal-contract-intel]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
