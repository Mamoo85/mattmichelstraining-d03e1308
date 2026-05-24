// Auto-translates top N active Etsy listings into DE/FR/ES via Gemini Flash → pushes to Etsy translation API.
// Cron: weekly. Manual: POST { limit?, languages?, force? }
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getEtsyAuth } from "../_shared/etsy-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_LANGS = ["de", "fr", "es"];
const DEFAULT_LIMIT = 20;
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SLEEP = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function translateOne(
  apiKey: string,
  payload: { title: string; description: string; tags: string[]; lang: string },
) {
  const sys = `You are a professional Etsy listing translator. Translate to ${payload.lang.toUpperCase()}.
Return STRICT JSON {"title": string, "description": string, "tags": string[]}.
Rules: title ≤140 chars, tags ≤20 chars each, keep emojis, preserve units, keep brand names in English.`;
  const user = JSON.stringify({ title: payload.title, description: payload.description.slice(0, 4000), tags: payload.tags || [] });
  const r = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`ai_${r.status}: ${txt.slice(0, 200)}`);
  const j = JSON.parse(txt);
  const content = j.choices?.[0]?.message?.content ?? "{}";
  const out = JSON.parse(content);
  if (!out.title || !out.description) throw new Error("ai_returned_empty_translation");
  // Truncate to Etsy limits
  out.title = String(out.title).slice(0, 140);
  out.tags = Array.isArray(out.tags) ? out.tags.slice(0, 13).map((t: string) => String(t).slice(0, 20)) : [];
  return out as { title: string; description: string; tags: string[] };
}

async function pushTranslation(
  shopId: string,
  listingId: number,
  lang: string,
  trans: { title: string; description: string; tags: string[] },
  apiKey: string,
  accessToken: string,
) {
  const url = `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/translations/${lang}`;
  const body = new URLSearchParams();
  body.set("title", trans.title);
  body.set("description", trans.description);
  for (const t of trans.tags) body.append("tags", t);
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      "x-api-key": apiKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`etsy_${r.status}: ${txt.slice(0, 250)}`);
  return JSON.parse(txt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const aiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!aiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 50);
    const languages: string[] = Array.isArray(body.languages) && body.languages.length ? body.languages : DEFAULT_LANGS;
    const force = body.force === true;
    const dryRun = body.dry_run === true;

    const { apiKey, accessToken, shopId } = await getEtsyAuth(sb);
    if (!shopId) throw new Error("shop_id_missing");

    // Pick top N active listings by most recent update
    const { data: listings, error: lerr } = await sb
      .from("etsy_products")
      .select("listing_id,title,description,tags,etsy_updated_ts")
      .eq("state", "active")
      .order("etsy_updated_ts", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (lerr) throw lerr;
    if (!listings?.length) {
      return new Response(JSON.stringify({ ok: true, message: "no_active_listings", translated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip ones we've already translated recently (unless force)
    let alreadyDone = new Set<string>();
    if (!force) {
      const ids = listings.map((l: any) => l.listing_id);
      const { data: done } = await sb
        .from("gng_translation_log")
        .select("listing_id,language")
        .in("listing_id", ids)
        .eq("status", "success")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      alreadyDone = new Set((done ?? []).map((d: any) => `${d.listing_id}|${d.language}`));
    }

    const results: any[] = [];
    let translatedCount = 0;
    let skipped = 0;
    let errors = 0;

    for (const l of listings) {
      for (const lang of languages) {
        const key = `${l.listing_id}|${lang}`;
        if (alreadyDone.has(key)) {
          skipped++;
          continue;
        }
        try {
          const trans = await translateOne(aiKey, {
            title: l.title ?? "",
            description: l.description ?? "",
            tags: l.tags ?? [],
            lang,
          });
          if (!dryRun) {
            await pushTranslation(shopId, l.listing_id, lang, trans, apiKey, accessToken);
          }
          await sb.from("gng_translation_log").insert({
            listing_id: l.listing_id,
            language: lang,
            title: trans.title,
            description_chars: trans.description.length,
            tags_count: trans.tags.length,
            status: dryRun ? "dry_run" : "success",
          });
          translatedCount++;
          results.push({ listing_id: l.listing_id, lang, status: "ok", title: trans.title.slice(0, 60) });
        } catch (e) {
          errors++;
          const msg = (e as Error).message;
          await sb.from("gng_translation_log").insert({
            listing_id: l.listing_id,
            language: lang,
            status: "error",
            error: msg.slice(0, 500),
          });
          results.push({ listing_id: l.listing_id, lang, status: "error", error: msg.slice(0, 200) });
        }
        await SLEEP(400); // gentle rate-limit
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        listings_considered: listings.length,
        languages,
        translated: translatedCount,
        skipped_recently_done: skipped,
        errors,
        dry_run: dryRun,
        results: results.slice(0, 30),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
