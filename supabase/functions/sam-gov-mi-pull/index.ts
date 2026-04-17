// sam-gov-mi-pull — daily cron. Pulls MI government contracts from SAM.gov API
// into growth_radar_signals for Growth Radar feed + digest.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!SAM_GOV_API_KEY) {
    return new Response(JSON.stringify({ error: "SAM_GOV_API_KEY missing" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
    const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

    const url = `https://api.sam.gov/opportunities/v2/search?api_key=${SAM_GOV_API_KEY}&postedFrom=${fmt(yesterday)}&postedTo=${fmt(today)}&state=MI&limit=100`;
    const res = await fetch(url);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `SAM.gov ${res.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const opps = data.opportunitiesData || [];

    let inserted = 0;
    for (const opp of opps) {
      const office = opp.officeAddress || {};
      const award = opp.award || {};
      const row = {
        source: "sam_gov",
        signal_type: "gov_contract",
        company_name: opp.organizationType || opp.fullParentPathName || "Unknown Agency",
        county: office.city || null,
        vertical: opp.naicsCode || null,
        value_usd: award.amount ? parseFloat(award.amount) : null,
        predicted_needs: opp.title ? [opp.title.slice(0, 200)] : [],
        recommended_pitch: `MI gov contract posted ${opp.postedDate || ""}: ${opp.title || ""}. NAICS ${opp.naicsCode || "n/a"}. Response deadline ${opp.responseDeadLine || "TBD"}.`,
        source_url: opp.uiLink || null,
        confidence: 8,
        detected_at: new Date().toISOString(),
        expires_at: opp.responseDeadLine ? new Date(opp.responseDeadLine).toISOString() : null,
        metadata: { notice_id: opp.noticeId, naics: opp.naicsCode, type: opp.type },
      };
      const { error } = await supabase.from("growth_radar_signals").insert(row);
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({ inserted, total_pulled: opps.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
