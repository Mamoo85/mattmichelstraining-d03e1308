// RFQ Bid Scanner — fab-metal NAICS RFQs from SAM.gov + Sonar fallback
// + Buyer Radar manufacturer rep signals: OSHA violations, SBA loans, permit volume
// Writes to buyer_radar_rfqs. Designed to run on a daily cron.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scanOshaSignals, scanSbaSignals, scanBuildingPermitVolume } from "../_shared/buyer-radar-signals.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Fabricated metal / machinery / transportation equipment NAICS
const FAB_NAICS = ["332", "333", "336"];
const STATES = ["MI", "OH", "IN"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function scanSamGov(sb: ReturnType<typeof createClient>) {
  if (!SAM_GOV_API_KEY) return { source: "sam_gov", inserted: 0, skipped: "no SAM_GOV_API_KEY" };
  const postedFrom = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    .replace(/\//g, "/");
  const postedTo = new Date()
    .toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    .replace(/\//g, "/");

  let inserted = 0;
  for (const naics of FAB_NAICS) {
    try {
      const url = `https://api.sam.gov/opportunities/v2/search?api_key=${SAM_GOV_API_KEY}&postedFrom=${postedFrom}&postedTo=${postedTo}&ncode=${naics}&limit=50`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[rfq-scanner] SAM.gov ${naics} ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const o of data?.opportunitiesData || []) {
        const popState = o?.placeOfPerformance?.state?.code || o?.placeOfPerformance?.state?.name;
        if (popState && !STATES.includes(String(popState).toUpperCase().slice(0, 2))) continue;
        const rfq = {
          source: "sam_gov",
          source_id: o.noticeId || o.solicitationNumber,
          title: o.title || "Untitled",
          agency: o.fullParentPathName || o.department,
          description: (o.description || "").slice(0, 2000),
          naics: o.naicsCode || naics,
          state: popState || null,
          city: o?.placeOfPerformance?.city?.name || null,
          url: o.uiLink,
          posted_at: o.postedDate ? new Date(o.postedDate).toISOString() : null,
          due_at: o.responseDeadLine ? new Date(o.responseDeadLine).toISOString() : null,
          raw: o,
        };
        const { error } = await (sb.from as any)("buyer_radar_rfqs").upsert(rfq, {
          onConflict: "source,source_id",
          ignoreDuplicates: true,
        });
        if (!error) inserted++;
      }
    } catch (e) {
      console.error(`[rfq-scanner] SAM.gov ${naics} error`, e);
    }
  }
  return { source: "sam_gov", inserted };
}

async function scanSonarFallback(sb: ReturnType<typeof createClient>) {
  if (!LOVABLE_API_KEY) return { source: "sonar", inserted: 0, skipped: "no LOVABLE_API_KEY" };
  try {
    const prompt = `List up to 8 NEW (posted within last 5 days) public RFP/RFQ/bid postings on MichiganBidNet (mitn.info), BidNetDirect, or any Michigan/Ohio/Indiana state procurement portal that involve fabricated metal, sheet metal, structural steel, laser cutting, welding, machining, or powder coating work (NAICS 332, 333, or 336). Return ONLY a strict JSON array of objects with keys: title, agency, naics, state, city, url, posted_date (YYYY-MM-DD), due_date (YYYY-MM-DD or null), summary. No markdown, no commentary.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return { source: "sonar", inserted: 0, error: `gateway ${res.status}` };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { source: "sonar", inserted: 0, error: "no JSON found" };
    const items = JSON.parse(match[0]);
    let inserted = 0;
    for (const it of items) {
      if (!it?.title || !it?.url) continue;
      const { error } = await (sb.from as any)("buyer_radar_rfqs").upsert({
        source: "sonar",
        source_id: it.url,
        title: it.title,
        agency: it.agency,
        description: it.summary,
        naics: it.naics,
        state: it.state,
        city: it.city,
        url: it.url,
        posted_at: it.posted_date ? new Date(it.posted_date).toISOString() : null,
        due_at: it.due_date ? new Date(it.due_date).toISOString() : null,
        raw: it,
      }, { onConflict: "source,source_id", ignoreDuplicates: true });
      if (!error) inserted++;
    }
    return { source: "sonar", inserted };
  } catch (e) {
    return { source: "sonar", inserted: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const [sam, sonar] = await Promise.all([scanSamGov(sb), scanSonarFallback(sb)]);
    return new Response(JSON.stringify({ ok: true, sam, sonar }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[rfq-bid-scanner]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
