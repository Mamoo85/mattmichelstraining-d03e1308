// Finds active Etsy listings with titles > 140 chars (Etsy's hard cap) and rewrites them
// via Gemini Flash, preserving primary keywords. Caps 5 listings/run to respect Etsy rate limits.
// Cron: weekly Wed 14:30 UTC. Manual: POST { limit?, dry_run?, max_len? }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ETSY_MAX = 140;

async function shortenTitle(title: string, tags: string[], maxLen: number): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an Etsy SEO copywriter. Rewrite the title to <= ${maxLen} characters total (count characters precisely). Preserve the most search-valuable keywords. Front-load buyer intent words. No emojis, no ALL CAPS, no quotes, no trailing punctuation. Return ONLY the rewritten title, nothing else.`,
        },
        {
          role: "user",
          content: `Original title (${title.length} chars): ${title}\nTags context: ${tags.slice(0, 8).join(", ")}`,
        },
      ],
    }),
  });
  const j = await r.json();
  let out: string = (j?.choices?.[0]?.message?.content ?? "").trim();
  out = out.replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ").trim();
  if (out.length > maxLen) out = out.slice(0, maxLen).trim();
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const maxLen = Math.min(Number(body.max_len ?? ETSY_MAX), 140);
    const limit = Math.min(Number(body.limit ?? 5), 15);

    const { apiKey, accessToken, shopId } = await getEtsyAuth(sb);
    if (!shopId) throw new Error("shop_id_missing");

    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id, title, tags")
      .eq("state", "active");
    if (error) throw error;

    const over = (listings ?? [])
      .filter((l) => (l.title?.length ?? 0) > maxLen)
      .sort((a, b) => (b.title?.length ?? 0) - (a.title?.length ?? 0))
      .slice(0, limit);

    const results: any[] = [];
    let applied = 0;

    for (const l of over) {
      try {
        const newTitle = await shortenTitle(l.title, l.tags ?? [], maxLen);
        if (!newTitle || newTitle.length > maxLen || newTitle.length < 20) {
          results.push({ listing_id: l.listing_id, action: "skip_bad_output", new_length: newTitle?.length ?? 0 });
          continue;
        }
        const logRow = {
          listing_id: l.listing_id,
          old_title: l.title,
          new_title: newTitle,
          old_length: l.title.length,
          new_length: newTitle.length,
        };
        if (dryRun) {
          await sb.from("gng_title_lint_log").insert({ ...logRow, applied: false });
          results.push({ ...logRow, action: "dry_run" });
          continue;
        }
        const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${l.listing_id}`;
        const r = await fetch(url, {
          method: "PATCH",
          headers: {
            "x-api-key": apiKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ title: newTitle }).toString(),
        });
        if (!r.ok) {
          const t = await r.text();
          await sb.from("gng_title_lint_log").insert({ ...logRow, applied: false, apply_error: `etsy_${r.status}: ${t.slice(0, 200)}` });
          results.push({ listing_id: l.listing_id, action: "etsy_error", status: r.status });
          continue;
        }
        await sb.from("etsy_products").update({ title: newTitle }).eq("listing_id", l.listing_id);
        await sb.from("gng_title_lint_log").insert({ ...logRow, applied: true });
        applied++;
        results.push({ ...logRow, action: "applied" });
        await SLEEP(600);
      } catch (e) {
        results.push({ listing_id: l.listing_id, action: "exception", error: (e as Error).message.slice(0, 150) });
      }
    }

    return new Response(JSON.stringify({ ok: true, candidates: over.length, applied, dry_run: dryRun, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
