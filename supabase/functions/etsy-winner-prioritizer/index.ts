// Winner prioritizer — looks at pod_niche_performance, picks the niche with
// highest sales (or highest views if no sales yet), and asks the trend-scanner
// to generate 5 fresh variant products for that winning niche.
//
// Body: { mode?: "auto"|"force", niche?: string, count?: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty body */ }
  const explicitNiche: string | undefined = body?.niche;
  const count: number = Math.min(10, Math.max(1, body?.count ?? 5));

  let niche = explicitNiche;
  let reason = "manual";

  if (!niche) {
    const { data: perf } = await sb
      .from("pod_niche_performance")
      .select("niche, total_sales, total_views, total_favorites, listings")
      .order("total_sales", { ascending: false })
      .order("total_views", { ascending: false })
      .limit(5);

    const top = (perf ?? []).find((r: any) => (r.total_sales ?? 0) > 0)
      || (perf ?? []).find((r: any) => (r.total_views ?? 0) > 25)
      || (perf ?? [])[0];

    if (!top) {
      return new Response(JSON.stringify({
        ok: false, skipped: true, reason: "no_performance_data_yet",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    niche = top.niche;
    reason = (top.total_sales ?? 0) > 0 ? "sales_winner" : "views_winner";
  }

  // Delegate to etsy-trend-scanner with forced niche and variant intent
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/etsy-trend-scanner`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      forced_niche: niche,
      count,
      intent: "variant_reprint",
      reason,
    }),
  });
  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }

  return new Response(JSON.stringify({
    ok: resp.ok, niche, reason, scanner_status: resp.status,
    scanner_response: json ?? text.slice(0, 500),
  }), { status: resp.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
