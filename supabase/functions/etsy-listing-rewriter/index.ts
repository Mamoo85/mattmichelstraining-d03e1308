// Weekly rewrite of the 5 weakest active Etsy listing titles + descriptions using Gemini Flash
// + fresh trending tags. Weak = title < 60 chars (Etsy SEO sweet spot is 120-140) or generic.
// Cron: weekly Tue 14:00 UTC. Manual: POST { limit?, dry_run? }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function rewrite(title: string, description: string, trending: string[]) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are an Etsy SEO copywriter. Return STRICT JSON: {\"title\": string (120-140 chars, front-load buyer keywords, no ALL CAPS, no emojis), \"description\": string (first 160 chars must be a hook + benefit, 600-1200 chars total, plain text, no markdown)}. Use 1-2 trending keywords naturally if relevant.",
        },
        {
          role: "user",
          content: `Original title: ${title}\n\nOriginal description (first 800 chars): ${(description ?? "").slice(0, 800)}\n\nTrending keywords: ${trending.join(", ")}`,
        },
      ],
    }),
  });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content ?? "{}";
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    if (typeof obj.title !== "string" || typeof obj.description !== "string") return null;
    return { title: obj.title.slice(0, 140), description: obj.description.slice(0, 5000) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body.limit ?? 5), 15);
    const dryRun = body.dry_run === true;

    const { apiKey, accessToken, shopId } = await getEtsyAuth(sb);
    if (!shopId) throw new Error("shop_id_missing");

    // Weakest = shortest titles among active listings
    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id,title,description")
      .eq("state", "active")
      .order("etsy_updated_ts", { ascending: true })
      .limit(200);
    if (error) throw error;

    const weak = (listings ?? [])
      .filter((l: any) => (l.title ?? "").length < 80)
      .slice(0, limit);

    const { data: trendRows } = await sb
      .from("gng_trend_signals")
      .select("tag")
      .order("captured_at", { ascending: false })
      .limit(40);
    const trending = Array.from(new Set((trendRows ?? []).map((r: any) => r.tag))).slice(0, 20);

    let updated = 0;
    const traces: any[] = [];

    for (const l of weak) {
      try {
        const rewritten = await rewrite(l.title, l.description ?? "", trending);
        if (!rewritten) {
          traces.push({ listing_id: l.listing_id, ok: false, reason: "llm_parse_failed" });
          continue;
        }
        if (dryRun) {
          traces.push({ listing_id: l.listing_id, ok: true, dry: true, new_title: rewritten.title });
          continue;
        }
        const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${l.listing_id}`;
        const form = new URLSearchParams({ title: rewritten.title, description: rewritten.description });
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
        const errTxt = ok ? "" : (await r.text()).slice(0, 200);
        if (ok) {
          updated++;
          await sb.from("etsy_products").update({ title: rewritten.title, description: rewritten.description }).eq("listing_id", l.listing_id);
        }
        traces.push({
          listing_id: l.listing_id,
          ok,
          status: r.status,
          old_title_len: (l.title ?? "").length,
          new_title_len: rewritten.title.length,
          error: ok ? undefined : errTxt,
        });
        await SLEEP(600);
      } catch (e) {
        traces.push({ listing_id: l.listing_id, ok: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, weak_found: weak.length, updated, traces }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
