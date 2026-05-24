// Weekly tag-overlap analyzer. Counts how many active listings use each tag, flags tags appearing
// in > 30% of the catalog (cannibalization risk). Writes to gng_tag_overlap_report.
// Cron: weekly Fri 14:00 UTC. Manual: POST { saturation_pct? } (default 30).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const minPct = Math.min(Math.max(Number(body.saturation_pct ?? 30), 5), 100);
    const today = new Date().toISOString().slice(0, 10);

    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id, tags")
      .eq("state", "active");
    if (error) throw error;

    const total = listings?.length ?? 0;
    if (!total) {
      return new Response(JSON.stringify({ ok: true, total_active: 0, flagged: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const counts = new Map<string, number>();
    for (const l of listings ?? []) {
      const seen = new Set<string>();
      for (const t of l.tags ?? []) {
        const tag = String(t).trim().toLowerCase();
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    const rows: any[] = [];
    for (const [tag, count] of counts.entries()) {
      const pct = (count / total) * 100;
      if (pct >= minPct) {
        rows.push({
          report_date: today,
          tag,
          listing_count: count,
          total_active: total,
          saturation_pct: Number(pct.toFixed(2)),
        });
      }
    }
    rows.sort((a, b) => b.saturation_pct - a.saturation_pct);

    if (rows.length) {
      for (let i = 0; i < rows.length; i += 100) {
        await sb.from("gng_tag_overlap_report").upsert(rows.slice(i, i + 100), { onConflict: "report_date,tag" });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      total_active: total,
      unique_tags: counts.size,
      flagged: rows.length,
      threshold_pct: minPct,
      top: rows.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
