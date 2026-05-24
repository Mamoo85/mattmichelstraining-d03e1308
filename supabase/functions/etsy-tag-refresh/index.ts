// Refreshes Etsy tags on the top 10 most-recently-updated active listings using fresh
// trending tags from gng_trend_signals. Etsy allows exactly 13 tags per listing.
// Cron: weekly Mon 15:00 UTC. Manual: POST { limit?, dry_run? }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function pickTags(title: string, currentTags: string[], trending: string[]): Promise<string[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are an Etsy SEO specialist. Return EXACTLY 13 tags (1-3 words, lowercase, no punctuation, <=20 chars each) as a JSON array. Mix high-intent buyer tags with 2-3 trending tags relevant to the product. No duplicates, no fluff.",
        },
        {
          role: "user",
          content: `Listing title: ${title}\nCurrent tags: ${currentTags.join(", ")}\nTrending candidates: ${trending.join(", ")}`,
        },
      ],
    }),
  });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content ?? "[]";
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) return [];
  const arr = JSON.parse(m[0]);
  return arr
    .filter((t: any) => typeof t === "string")
    .map((t: string) => t.trim().toLowerCase().slice(0, 20))
    .filter((t: string, i: number, a: string[]) => t && a.indexOf(t) === i)
    .slice(0, 13);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body.limit ?? 10), 25);
    const dryRun = body.dry_run === true;

    const { apiKey, accessToken, shopId } = await getEtsyAuth(sb);
    if (!shopId) throw new Error("shop_id_missing");

    const [{ data: listings }, { data: trendRows }] = await Promise.all([
      sb.from("etsy_products").select("listing_id,title,tags").eq("state", "active").order("etsy_updated_ts", { ascending: false }).limit(limit),
      sb.from("gng_trend_signals").select("tag").order("captured_at", { ascending: false }).limit(50),
    ]);

    const trending = Array.from(new Set((trendRows ?? []).map((r: any) => r.tag))).slice(0, 30);
    if (!trending.length) {
      return new Response(JSON.stringify({ ok: false, error: "no_trending_tags_available — run gng-trend-scraper first" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    const traces: any[] = [];

    for (const l of listings ?? []) {
      try {
        const newTags = await pickTags(l.title, l.tags ?? [], trending);
        if (newTags.length !== 13) {
          traces.push({ listing_id: l.listing_id, ok: false, reason: `bad_tag_count_${newTags.length}` });
          continue;
        }
        if (dryRun) {
          traces.push({ listing_id: l.listing_id, ok: true, new_tags: newTags, dry: true });
          continue;
        }
        const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${l.listing_id}`;
        const form = new URLSearchParams();
        for (const t of newTags) form.append("tags", t);
        const r = await fetch(url, {
          method: "PATCH",
          headers: {
            "x-api-key": apiKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        const ok = r.ok;
        const txt = ok ? "" : (await r.text()).slice(0, 200);
        if (ok) {
          updated++;
          await sb.from("etsy_products").update({ tags: newTags }).eq("listing_id", l.listing_id);
        }
        traces.push({ listing_id: l.listing_id, ok, status: r.status, error: ok ? undefined : txt, new_tags: newTags });
        await SLEEP(400);
      } catch (e) {
        traces.push({ listing_id: l.listing_id, ok: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, listings_considered: listings?.length ?? 0, updated, traces }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
