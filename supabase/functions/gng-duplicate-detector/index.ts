// Weekly near-duplicate detector across active Etsy listings. Uses normalized-token Jaccard
// similarity over title + tags. Flags pairs with sim >= 0.78 into gng_duplicate_flags.
// Cron: weekly Thu 14:00 UTC. Manual: POST { threshold?, max_pairs? }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function tokenize(s: string): Set<string> {
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const threshold = Math.min(Math.max(Number(body.threshold ?? 0.78), 0.5), 0.99);
    const maxPairs = Math.min(Number(body.max_pairs ?? 200), 1000);

    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id, title, tags")
      .eq("state", "active");
    if (error) throw error;

    const items = (listings ?? []).map((l) => ({
      id: l.listing_id,
      title: l.title ?? "",
      tokens: tokenize(`${l.title ?? ""} ${(l.tags ?? []).join(" ")}`),
    }));

    const pairs: Array<{ a: any; b: any; sim: number }> = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const sim = jaccard(items[i].tokens, items[j].tokens);
        if (sim >= threshold) pairs.push({ a: items[i], b: items[j], sim });
      }
    }
    pairs.sort((x, y) => y.sim - x.sim);
    const top = pairs.slice(0, maxPairs);

    if (top.length) {
      const rows = top.map((p) => ({
        listing_id_a: p.a.id,
        listing_id_b: p.b.id,
        similarity: Number(p.sim.toFixed(4)),
        reason: `jaccard_title_tags>=${threshold}`,
        title_a: p.a.title.slice(0, 200),
        title_b: p.b.title.slice(0, 200),
      }));
      // Insert in chunks; ignore conflicts on identical pairs from prior weeks
      for (let i = 0; i < rows.length; i += 100) {
        await sb.from("gng_duplicate_flags").insert(rows.slice(i, i + 100));
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      compared: items.length,
      pairs_flagged: top.length,
      threshold,
      top_sample: top.slice(0, 10).map((p) => ({ a: p.a.id, b: p.b.id, sim: p.sim })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
